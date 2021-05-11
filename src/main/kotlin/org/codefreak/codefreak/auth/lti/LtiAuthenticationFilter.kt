package org.codefreak.codefreak.auth.lti

import com.google.common.base.Strings
import com.google.common.collect.Lists
import com.google.gson.JsonParser
import com.nimbusds.jose.Algorithm
import com.nimbusds.jose.JWSAlgorithm
import com.nimbusds.jose.JWSHeader
import com.nimbusds.jwt.JWTClaimsSet
import com.nimbusds.jwt.JWTParser
import com.nimbusds.jwt.PlainJWT
import com.nimbusds.jwt.SignedJWT
import java.text.ParseException
import java.util.Date
import java.util.UUID
import javax.servlet.http.HttpServletRequest
import javax.servlet.http.HttpServletResponse
import org.mitre.jwt.signer.service.JWTSigningAndValidationService
import org.mitre.openid.connect.client.OIDCAuthenticationFilter
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.http.HttpEntity
import org.springframework.http.HttpHeaders
import org.springframework.http.MediaType
import org.springframework.security.authentication.AuthenticationServiceException
import org.springframework.security.core.Authentication
import org.springframework.util.LinkedMultiValueMap
import org.springframework.web.client.RestClientException
import org.springframework.web.client.RestTemplate

class LtiAuthenticationFilter : OIDCAuthenticationFilter() {

  @Autowired
  lateinit var restClient: RestTemplate

  @Autowired
  lateinit var authenticationSignerService: JWTSigningAndValidationService

  /**
   * Attempt authentication with the id_token that may be in the request
   */
  override fun attemptAuthentication(request: HttpServletRequest?, response: HttpServletResponse?): Authentication? {
    // LTI OIDC login will immediately answer with an id_token instead of a code authorization
    if (request?.getParameter("id_token") != null) {
      return handleIdTokenResponse(request)
    }

    return super.attemptAuthentication(request, response)
  }

  /**
   * This is pretty much a copy&paste version of {@link OIDCAuthenticationFilter#handleIdTokenResponse} adapted to the
   * "short" OpenID Connect interpretation used in LTI.
   * It will read the state parameter and check to the stored one and afterwards request an access token by using
   * the "client_credentials" grant (and not the "authorization_code" grant).
   * Finally the JWT from the id_token parameter will be evaluated and
   */
  private fun handleIdTokenResponse(request: HttpServletRequest): Authentication? {
    val session = request.getSession(false)

    // check for state, if it doesn't match we bail early
    val storedState = getStoredState(session)
    val requestState = request.getParameter("state")
    if (storedState == null || storedState != requestState) {
      throw AuthenticationServiceException("State parameter mismatch on return. Expected $storedState got $requestState")
    }

    // look up the issuer that we set out to talk to
    val issuer = session.getAttribute(ISSUER_SESSION_VARIABLE).toString()

    // pull the configurations based on that issuer
    val serverConfig = serverConfigurationService.getServerConfiguration(issuer)
    val clientConfig = clientConfigurationService.getClientConfiguration(serverConfig)

    // start building the request send via HTTP from backend to the OIDC provider
    val form = LinkedMultiValueMap<String, String>()
    form.add("grant_type", "client_credentials")
    form.setAll(authRequestOptionsService.getTokenOptions(serverConfig, clientConfig, request))

    val codeVerifier = getStoredCodeVerifier(session)
    if (codeVerifier != null) {
      form.add("code_verifier", codeVerifier)
    }

    val redirectUri = session.getAttribute(REDIRECT_URI_SESION_VARIABLE)?.toString()
    if (redirectUri != null) {
      form.add("redirect_uri", redirectUri)
    }

    val alg: JWSAlgorithm = clientConfig.tokenEndpointAuthSigningAlg

    val claimsSet = JWTClaimsSet.Builder()

    claimsSet.issuer(clientConfig.clientId)
    claimsSet.subject(clientConfig.clientId)
    claimsSet.audience(Lists.newArrayList(serverConfig.tokenEndpointUri))
    claimsSet.jwtID(UUID.randomUUID().toString())

    val exp = Date(System.currentTimeMillis() + 60 * 1000) // auth good for 60 seconds
    claimsSet.expirationTime(exp)

    val now = Date(System.currentTimeMillis())
    claimsSet.issueTime(now)
    claimsSet.notBeforeTime(now)

    val header = JWSHeader(
        alg, null, null, null, null, null, null, null, null, null,
        authenticationSignerService.defaultSignerKeyId, true, null, null
    )
    val jwt = SignedJWT(header, claimsSet.build())

    authenticationSignerService.signJwt(jwt, alg)

    form.add("client_assertion_type", "urn:ietf:params:oauth:client-assertion-type:jwt-bearer")
    form.add("client_assertion", jwt.serialize())
    form.add(
        "scope", setOf(
        "https://purl.imsglobal.org/spec/lti-nrps/scope/contextmembership.readonly",
        "https://purl.imsglobal.org/spec/lti-ags/scope/score",
        "https://purl.imsglobal.org/spec/lti-ags/scope/result.readonly"
    ).joinToString(" ")
    )

    logger.debug("tokenEndpointURI = " + serverConfig.tokenEndpointUri)
    logger.debug("form = $form")

    val jsonString: String?
    val httpRequest = HttpEntity(form, HttpHeaders().apply {
      this.contentType = MediaType.APPLICATION_FORM_URLENCODED
    })

    try {
      jsonString = restClient.postForObject(serverConfig.tokenEndpointUri, httpRequest, String::class.java)
    } catch (e: RestClientException) {

      logger.error("Token Endpoint error response: ${e.message}")

      throw AuthenticationServiceException("Unable to obtain Access Token: " + e.message)
    }

    logger.debug("from TokenEndpoint jsonString = " + jsonString!!)

    val jsonRoot = JsonParser.parseString(jsonString)
    if (!jsonRoot.isJsonObject) {
      throw AuthenticationServiceException("Token Endpoint did not return a JSON object: $jsonRoot")
    }

    val tokenResponse = jsonRoot.asJsonObject

    if (tokenResponse.get("error") != null) {

      val error = tokenResponse.get("error").asString

      logger.error("Token Endpoint returned: $error")

      throw AuthenticationServiceException("Unable to obtain Access Token.  Token Endpoint returned: $error")
    } else {
      val accessTokenValue: String?

      if (tokenResponse.has("access_token")) {
        accessTokenValue = tokenResponse.get("access_token").asString
      } else {
        throw AuthenticationServiceException("Token Endpoint did not return an access_token: $jsonString")
      }

      val idTokenValue = request.getParameter("id_token")
      try {
        val idToken = JWTParser.parse(idTokenValue)

        // validate our ID Token over a number of tests
        val idClaims = idToken.jwtClaimsSet

        // check the signature
        val jwtValidator: JWTSigningAndValidationService?

        val tokenAlg = idToken.header.algorithm

        val clientAlg = clientConfig.idTokenSignedResponseAlg

        if (clientAlg != null) {
          if (clientAlg != tokenAlg) {
            throw AuthenticationServiceException("Token algorithm $tokenAlg does not match expected algorithm $clientAlg")
          }
        }

        if (idToken is PlainJWT) {

          if (clientAlg == null) {
            throw AuthenticationServiceException("Unsigned ID tokens can only be used if explicitly configured in client.")
          }

          if (tokenAlg == Algorithm.NONE) {
            throw AuthenticationServiceException("Unsigned token received, expected signature with $tokenAlg")
          }
        } else if (idToken is SignedJWT) {

          jwtValidator = when (tokenAlg) {
            // generate one based on client secret
            JWSAlgorithm.HS256,
            JWSAlgorithm.HS384,
            JWSAlgorithm.HS512 -> symmetricCacheService.getSymmetricValidtor(clientConfig.client)
            // otherwise load from the server's public key
            else -> validationServices.getValidator(serverConfig.jwksUri)
          }

          if (jwtValidator != null) {
            if (!jwtValidator.validateSignature(idToken)) {
              throw AuthenticationServiceException("Signature validation failed")
            }
          } else {
            logger.error("No validation service found. Skipping signature validation")
            throw AuthenticationServiceException("Unable to find an appropriate signature validator for ID Token.")
          }
        }

        // check the issuer
        if (idClaims.issuer == null) {
          throw AuthenticationServiceException("Id Token Issuer is null")
        } else if (idClaims.issuer != serverConfig.issuer) {
          throw AuthenticationServiceException("Issuers do not match, expected " + serverConfig.issuer + " got " + idClaims.issuer)
        }

        // check expiration
        val timeFrame = (System.currentTimeMillis() - timeSkewAllowance * 1000)..(System.currentTimeMillis() + timeSkewAllowance * 1000)
        if (idClaims.expirationTime == null) {
          throw AuthenticationServiceException("Id Token does not have required expiration claim")
        } else {
          // it's not null, see if it's expired
          if (timeFrame.last < idClaims.expirationTime.time) {
            throw AuthenticationServiceException("Id Token is expired: " + idClaims.expirationTime)
          }
        }

        // check not before
        if (idClaims.notBeforeTime != null) {
          if (timeFrame.first < idClaims.notBeforeTime.time) {
            throw AuthenticationServiceException("Id Token not valid until: " + idClaims.notBeforeTime)
          }
        }

        // check issued at
        if (idClaims.issueTime == null) {
          throw AuthenticationServiceException("Id Token does not have required issued-at claim")
        } else {
          // since it's not null, see if it was issued in the future
          if (timeFrame.last < idClaims.issueTime.time) {
            throw AuthenticationServiceException("Id Token was issued in the future: " + idClaims.issueTime)
          }
        }

        // check audience
        if (idClaims.audience == null) {
          throw AuthenticationServiceException("Id token audience is null")
        } else if (!idClaims.audience.contains(clientConfig.clientId)) {
          throw AuthenticationServiceException("Audience does not match, expected " + clientConfig.clientId + " got " + idClaims.audience)
        }

        // compare the nonce to our stored claim
        val nonce = idClaims.getStringClaim("nonce")
        if (Strings.isNullOrEmpty(nonce)) {

          logger.error("ID token did not contain a nonce claim.")

          throw AuthenticationServiceException("ID token did not contain a nonce claim.")
        }

        val storedNonce = getStoredNonce(session)
        if (nonce != storedNonce) {
          val message = "Possible replay attack detected! The comparison of the nonce in the returned ID Token to the session " +
              "$NONCE_SESSION_VARIABLE failed. Expected $storedNonce got $nonce."
          logger.warn(message)
          throw AuthenticationServiceException(message)
        }

        // remove stored redirect URI so we can decide on a redirect URL in our own success handler
        // {@link OIDCAuthenticationFilter} imposes a success handler that cannot be overridden otherwise but delegates
        // the handling to a default handler if the "TARGET_SESSION_VARIABLE" is missing in the session
        session.removeAttribute(TARGET_SESSION_VARIABLE)

        val token = PendingLtiAuthenticationToken(
            idClaims.subject, idClaims.issuer,
            serverConfig,
            idToken,
            accessTokenValue,
            null
        )

        return authenticationManager.authenticate(token)
      } catch (e: ParseException) {
        throw AuthenticationServiceException("Couldn't parse id_token: ", e)
      }
    }
  }
}
