import { useEffect } from "react"

const useRag = () => {
    useEffect(() => {
        const ragTime = setInterval(() => {
            console.log('useRag')
        }, 1000)
        return () => clearInterval(ragTime)
    }, [])
}