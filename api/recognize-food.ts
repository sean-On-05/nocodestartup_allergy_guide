import { handleRecognition } from '../server/recognition.js'

export default { fetch: (request: Request) => handleRecognition(request) }
