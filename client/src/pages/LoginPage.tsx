import { LockOutlined, UserOutlined } from '@ant-design/icons'
import { Button, Card, Form, Input } from 'antd'
import { useState } from 'react'
import Centered from '../components/Centered'
import Logo from '../components/Logo'
import { AuthenticatedUser } from '../hooks/useAuthenticatedUser'
import { useLoginMutation } from '../services/codefreak-api'

interface Credentials {
  username: string
  password: string
}

interface LoginProps {
  loggingOut: boolean
  onSuccessfulLogin: (user: AuthenticatedUser) => Promise<unknown>
}

const LoginPage: React.FC<LoginProps> = props => {
  const { onSuccessfulLogin, loggingOut } = props
  const [loading, setLoading] = useState<boolean>(false)
  const [login] = useLoginMutation({
    errorPolicy: 'ignore' // prevents unhandled rejection errors
  })

  const handleSubmit = async (values: Credentials) => {
    setLoading(true)
    // errors during login are shown by our global error handling
    try {
      const { data } = await login({ variables: values })
      if (data?.login) {
        await onSuccessfulLogin(data.login.user)
      }
    } finally {
      // get out of loading mode even if something goes wrong
      setLoading(false)
    }
  }

  return (
    <Centered className="background-carbon">
      <Card
        title={
          <h1
            style={{
              marginBottom: -16,
              textAlign: 'center'
            }}
          >
            <Logo height={64} />
          </h1>
        }
        style={{ width: '100%', maxWidth: 300, margin: 16 }}
        headStyle={{ borderBottom: 'none' }}
      >
        <Form onFinish={handleSubmit} name="login">
          <Form.Item
            name="username"
            rules={[
              {
                required: true,
                message: 'Please input your username!'
              }
            ]}
          >
            <Input
              prefix={<UserOutlined style={{ color: 'rgba(0,0,0,.25)' }} />}
              autoComplete="username"
              autoFocus
              placeholder="Username / Mail Address"
              disabled={loggingOut}
            />
          </Form.Item>
          <Form.Item
            name="password"
            rules={[
              {
                required: true,
                message: 'Please input your password!'
              }
            ]}
          >
            <Input
              prefix={<LockOutlined style={{ color: 'rgba(0,0,0,.25)' }} />}
              autoComplete="password"
              type="password"
              placeholder="Password"
              disabled={loggingOut}
            />
          </Form.Item>
          <Form.Item style={{ marginBottom: 0 }}>
            <Button
              type="primary"
              htmlType="submit"
              style={{ width: '100%' }}
              loading={loading || loggingOut}
              disabled={loggingOut}
            >
              {loggingOut ? 'Logging out…' : 'Sign in'}
            </Button>
          </Form.Item>
        </Form>
      </Card>
    </Centered>
  )
}

export default LoginPage
