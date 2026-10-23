import { handleApi } from "../../backend/api.js"

export async function onRequest(context) {
  return handleApi(context.request, context.env)
}
