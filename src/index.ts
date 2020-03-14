
import { validate } from 'jsonschema'
import { Options, Connector, CallParameters, EndpointSchema } from './interfaces'

export * from './interfaces'

type EndpointMap = Record<string, EndpointSchema<{}, {}>>

interface APICallable <O, E extends EndpointMap = {}> {
  <T, U>(
    endpoint: EndpointSchema<T, U>,
    parameters: CallParameters<T, O>,
    callOptions?: Options
  ): Promise<U>;

  <K extends keyof E, S extends EndpointSchema<{}, {}> = E[K]>(
    endpoint: K,
    parameters: CallParameters<ReturnType<S['request']['getType']>, O>,
    callOptions?: Options
  ): Promise<ReturnType<S['response']['getType']>>;
}

export function apiFactory <O extends Options, E extends EndpointMap> (defaultOptions: O, endpoints: E, connector: Connector): APICallable<O, E> {
  async function callWithObject <T, U> (
    endpoint: EndpointSchema<T, U>,
    parameters: CallParameters<T, O>,
    callOptions?: Options
  ): Promise<U> {
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

  async function callWithId <K extends keyof E> (
    endpoint: K,
    parameters: CallParameters<{}, {}>,
    callOptions?: Options
  ): Promise<unknown> {
    const endpointObject = endpoints[endpoint]
    return callWithObject(endpointObject, parameters, callOptions)
  }

  return async function api (
    endpoint: string | EndpointSchema<{}, {}>,
    parameters: CallParameters<{}, {}>,
    callOptions?: Options
  ): Promise<unknown> {
    if (typeof endpoint === 'string') {
      return callWithId(endpoint, parameters, callOptions)
    }
    return callWithObject(endpoint, parameters, callOptions)
  }
}
