import { useState } from 'react'
import reactLogo from './assets/react.svg'
import viteLogo from '/vite.svg'
import './App.css'
import HeartDiseaseRiskForm from './components/ataque-form'

function App() {
  const [count, setCount] = useState(0)

  return (
    <>
      <HeartDiseaseRiskForm />
    </>
  )
}

export default App
