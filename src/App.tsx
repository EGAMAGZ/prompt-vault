import { useState } from 'react'
import { Button } from '@/components/ui/button'

function App() {
  const [count, setCount] = useState(0)

  return (
    <>
    	<h1 class="text-8xl">Sample</h1>
      <Button>Default</Button>
    </>
  )
}

export default App
