import { useEffect, useState } from 'react'

export default function App() {
  const [health, setHealth] = useState(null)
  const [error, setError] = useState(null)

  // useEffect runs once when the page loads: here it calls our API
  useEffect(() => {
    fetch('/api/health')
      .then((res) => res.json())
      .then(setHealth)
      .catch(() => setError('Cannot reach the API'))
  }, [])

  return (
    <main style={{ padding: 24, fontFamily: 'sans-serif' }}>
      <h1>CivicSync</h1>
      {health && <p>API says: {health.status}</p>}
      {error && <p>{error}</p>}
    </main>
  )
}