import { useNavigate } from 'react-router-dom'
import RegistrationFlow from '../features/registration/RegistrationFlow'

export default function RegisterPage() {
  const navigate = useNavigate()
  return <RegistrationFlow onClose={() => navigate(-1)} />
}
