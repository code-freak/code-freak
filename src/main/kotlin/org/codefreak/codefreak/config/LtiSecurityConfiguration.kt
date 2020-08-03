package org.codefreak.codefreak.config

import com.nimbusds.jose.JWSAlgorithm
import com.nimbusds.jose.jwk.JWK
import java.security.KeyStore
import org.codefreak.codefreak.auth.lti.IdCodeAuthRequestBuilder
import org.codefreak.codefreak.auth.lti.LtiAuthenticationFilter
import org.codefreak.codefreak.auth.lti.LtiAuthenticationProvider
import org.codefreak.codefreak.auth.lti.LtiAuthenticationSuccessHandler
import org.codefreak.codefreak.service.UserService
import org.mitre.jwt.signer.service.JWTSigningAndValidationService
import org.mitre.jwt.signer.service.impl.DefaultJWTSigningAndValidationService
import org.mitre.oauth2.model.ClientDetailsEntity
import org.mitre.oauth2.model.RegisteredClient
import org.mitre.openid.connect.client.service.AuthRequestUrlBuilder
import org.mitre.openid.connect.client.service.ClientConfigurationService
import org.mitre.openid.connect.client.service.IssuerService
import org.mitre.openid.connect.client.service.ServerConfigurationService
import org.mitre.openid.connect.client.service.impl.StaticAuthRequestOptionsService
import org.mitre.openid.connect.client.service.impl.StaticClientConfigurationService
import org.mitre.openid.connect.client.service.impl.StaticServerConfigurationService
import org.mitre.openid.connect.client.service.impl.ThirdPartyIssuerService
import org.mitre.openid.connect.config.ServerConfiguration
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import org.springframework.core.annotation.Order
import org.springframework.security.config.annotation.authentication.builders.AuthenticationManagerBuilder
import org.springframework.security.config.annotation.web.builders.HttpSecurity
import org.springframework.security.config.annotation.web.configuration.WebSecurityConfigurerAdapter
import org.springframework.security.core.session.SessionRegistry
import org.springframework.security.web.authentication.AuthenticationSuccessHandler
import org.springframework.security.web.authentication.preauth.AbstractPreAuthenticatedProcessingFilter
import org.springframework.security.web.authentication.session.RegisterSessionAuthenticationStrategy

@ConditionalOnProperty("codefreak.lti.enabled")
@Configuration
@Order(1)
class LtiSecurityConfiguration(
  @Autowired appConfiguration: AppConfiguration,
  @Autowired val userService: UserService,
  @Autowired val sessionRegistry: SessionRegistry
) : WebSecurityConfigurerAdapter() {
  val config = appConfiguration.lti
  private val ltiLoginPath = "/lti/login"

  /**
   * Specific security configuration for the LTI part of the application
   */
  override fun configure(http: HttpSecurity?) {
    // @formatter:off
    http?.antMatcher("/lti/**")
        ?.authorizeRequests()
            ?.antMatchers(ltiLoginPath)?.permitAll()
            ?.anyRequest()?.authenticated()
            ?.and()
        // Allow all LTI platforms to embed our content via CSP
        ?.headers()
            ?.frameOptions()?.disable()
            ?.contentSecurityPolicy(
                "frame-ancestors 'self' " + config.providers.map { provider -> provider.issuer }.joinToString(" ")
            )?.and()
            ?.and()
        // LTI 1.3 posts signed JWT from the LMS to Code FREAK on login which is okay
        ?.csrf()
            ?.ignoringAntMatchers(ltiLoginPath)
            ?.and()
        ?.addFilterBefore(ltiAuthenticationFilter(), AbstractPreAuthenticatedProcessingFilter::class.java)
    // @formatter:on
  }

  override fun configure(auth: AuthenticationManagerBuilder?) {
    auth?.authenticationProvider(LtiAuthenticationProvider(userService))
  }

  @Bean
  fun ltiAuthenticationFilter(): LtiAuthenticationFilter {
    return LtiAuthenticationFilter().apply {
      this.setAuthenticationManager(authenticationManager())
      this.issuerService = staticIssuerService()
      this.serverConfigurationService = serverConfigurationService()
      this.clientConfigurationService = staticClientConfigurationService()
      this.authRequestOptionsService = staticAuthRequestOptionsService()
      this.authRequestUrlBuilder = authRequestUrlBuilder()
      this.setAuthenticationSuccessHandler(ltiAuthSuccessHandler())
      this.setFilterProcessesUrl(ltiLoginPath)
      // register session after login for websocket authentication
      this.setSessionAuthenticationStrategy(registerSessionAuthStrategy())
    }
  }

  @Bean
  fun registerSessionAuthStrategy() = RegisterSessionAuthenticationStrategy(sessionRegistry)

  @Bean
  fun ltiAuthSuccessHandler(): AuthenticationSuccessHandler {
    return LtiAuthenticationSuccessHandler("/lti/launch")
  }

  @Bean
  fun jwtSigningAndValidationService(): JWTSigningAndValidationService? {
    val keyStore = config.keyStore ?: return null
    if (!keyStore.exists()) {
      throw RuntimeException("Provided keystore does not exist: ${keyStore.description}")
    }

    // construct a key store from configuration that contains all public and private keys
    val ks = KeyStore.getInstance(config.keyStoreType)
    ks.load(keyStore.inputStream, config.keyStorePassword?.toCharArray())
    return DefaultJWTSigningAndValidationService(config.providers.map {
      it.issuer to JWK.load(ks, it.keyStoreEntryName, it.keyStoreEntryPin.toCharArray())
    }.toMap()).apply {
      this.defaultSignerKeyId = config.providers.first().issuer
      this.defaultSigningAlgorithmName = "RS256"
    }
  }

  @Bean
  fun authRequestUrlBuilder(): AuthRequestUrlBuilder {
    return IdCodeAuthRequestBuilder()
  }

  @Bean
  fun staticClientConfigurationService(): ClientConfigurationService {
    return StaticClientConfigurationService().apply {
      this.clients = config.providers.map {
        it.issuer to RegisteredClient().apply {
          this.clientName = it.name
          this.clientId = it.clientId
          this.scope = setOf("openid")
          this.tokenEndpointAuthMethod = ClientDetailsEntity.AuthMethod.PRIVATE_KEY
          this.tokenEndpointAuthSigningAlg = JWSAlgorithm.RS256
        }
      }.toMap()
    }
  }

  @Bean
  fun staticAuthRequestOptionsService(): StaticAuthRequestOptionsService {
    return StaticAuthRequestOptionsService().apply {
      this.options = mapOf(
          "response_mode" to "form_post"
      )
    }
  }

  @Bean
  fun serverConfigurationService(): ServerConfigurationService {
    return StaticServerConfigurationService().apply {
      this.servers = config.providers.map {
        it.issuer to ServerConfiguration().apply {
          this.issuer = it.issuer
          this.authorizationEndpointUri = it.authUrl
          this.tokenEndpointUri = it.tokenUrl
          this.jwksUri = it.jwkUrl
        }
      }.toMap()
    }
  }

  @Bean
  fun staticIssuerService(): IssuerService {
    return ThirdPartyIssuerService().apply {
      // I am not sure when this is needed actually
      this.accountChooserUrl = "/error"
    }
  }
}
