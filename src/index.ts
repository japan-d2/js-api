
import { validate } from 'jsonschema'
import { Options, Connector, CallParameters, EndpointSchema } from './interfaces'

type APICallable <O> = <T, U>(
  endpoint: EndpointSchema<T, U>,
  parameters: CallParameters<T, O>,
  callOptions?: Options
) => Promise<U>

export function apiFactory <O extends Options> (defaultOptions: O, connector: Connector): APICallable<O> {
  return async function api <T, U> (endpoint: EndpointSchema<T, U>, parameters: CallParameters<T, O>, callOptions?: Options): Promise<U> {
    const options = { ...defaultOptions, ...(callOptions || {}) }
    if (options.validateRequest) {
      const result = validate({
        queryStringParameters: parameters.query,
        ...parameters
      }, endpoint.request.toJSONSchema(), options.validateRequest)
      if (!result.valid) {
        console.warn('[api] request parameter validation failed.', result)
      }
    }
    const response = await connector({
      url: endpoint.url,
      method: endpoint.method,
      query: {
        ...options.query,
        ...parameters.query
      },
      headers: {
        ...options.headers,
        ...parameters.headers
      },
      body: 'body' in parameters ? (parameters as any).body : {}
    })
    if (options.validateResponse) {
      const result = validate({
        body: response.body,
        headers: response.headers
      }, endpoint.response.toJSONSchema(), options.validateResponse)
      if (!result.valid) {
        console.warn('[api] response parameter validation failed.', result)
      }
    }
    return response as unknown as U
  }
}
