import { validate, Options as ValidateOptions } from 'jsonschema'
import { Options, Connector, CallParameters, EndpointSchema, CallOptions, EndpointMap, EndpointCallable, Json, APICallable, EndpointSchemaUnknown, Interceptor, ResponseParameter } from './interfaces'
import { JSONSchema7 } from 'json-schema'

export * from './interfaces'

export function buildInitialValue (schema: JSONSchema7, useDefault = false): Json | unknown {
  if (useDefault && schema.default) {
    return schema.default
  }

  if (schema.const) {
    return schema.const
  }

  if (schema.enum) {
    return schema.enum[0]
  }

  switch (schema.type) {
    case 'string': return ''
    case 'number': return 0
    case 'integer': return 0
    case 'boolean': return false
    case 'array': return []
    case 'null': return null
  }

  if (schema.type === 'object') {
    const { properties } = schema
    if (!properties) {
      return null
    }

    const obj: { [key: string]: Json | unknown } = {}
    for (const key of Object.keys(properties)) {
      if (typeof properties !== 'object') {
        continue
      }
      const value = properties[key]
      if (typeof value !== 'object') {
        continue
      }
      obj[key] = buildInitialValue(value, useDefault)
    }

    return obj
  }

  return null
}

export function apiFactory <O extends Options, E extends EndpointMap> (
  defaultOptions: O,
  endpoints: E,
  connector: Connector
): APICallable<O, E> {
  const interceptors: Record<string, Interceptor<EndpointSchemaUnknown>[]> = {}
  async function call <T, U> (
    endpoint: EndpointSchema<T, U>,
    parameters: CallParameters<T, O>,
    callOptions?: CallOptions
  ): Promise<U> {
    const options = { ...defaultOptions, ...(callOptions || {}) }
    const query = {
      ...options.query,
      ...parameters.query
    }
    const headers = {
      ...options.headers,
      ...parameters.headers
    }
    const body = 'body' in parameters ? (parameters as any).body : {}

    if (options.validateRequest) {
      const preprocessor = options.preprocessors?.validation?.request ?? ((parameters) => parameters)
      const result = validate(preprocessor({
        query,
        headers,
        body
      }), endpoint.request.toJSONSchema(), options.validateRequest)
      if (!result.valid) {
        console.warn('[api] request parameter validation failed.', result)
      }
    }

    let interceptResult: ResponseParameter | undefined
    const interceptors = ([...(options.interceptors ?? [])]).reverse()

    for (const interceptor of interceptors) {
      const result = await interceptor(parameters)
      if (result !== null) {
        interceptResult = result as ResponseParameter
        break
      }
    }

    const response = interceptResult ?? await connector({
      url: endpoint.url,
      method: endpoint.method,
      query,
      headers,
      body,
      schema: endpoint
    })

    if (options.validateResponse) {
      const preprocessor = options.preprocessors?.validation?.response ?? ((parameters) => parameters)
      const result = validate(preprocessor({
        body: response.body,
        headers: response.headers
      }), endpoint.response.toJSONSchema(), options.validateResponse)
      if (!result.valid) {
        console.warn('[api] response parameter validation failed.', result)
      }
    }
    return response as unknown as U
  }

  function endpointObject (endpoint: any): EndpointSchemaUnknown {
    if (typeof endpoint === 'string') {
      return endpoints[endpoint]
    }
    return endpoint
  }

  function cast (endpoint: string | EndpointSchemaUnknown): EndpointCallable<unknown, unknown, O> {
    const methods = {
      validate: (parameters: any, options?: Omit<ValidateOptions, 'throwError'>): parameters is any => {
        const schema = endpointObject(endpoint).request.toJSONSchema()
        return validate(parameters, schema, {
          ...options,
          throwError: false
        }).valid
      },
      assertValid: (parameters: any, options?: Omit<ValidateOptions, 'throwError'>): asserts parameters is any => {
        const schema = endpointObject(endpoint).request.toJSONSchema()
        validate(parameters, schema, {
          ...options,
          throwError: true
        })
      },
      call: (parameters: Record<string, unknown>, callOptions: CallOptions = {}): Promise<Record<string, unknown>> => {
        return call(endpointObject(endpoint), parameters, {
          ...callOptions,
          interceptors: [
            ...(typeof endpoint === 'string' ? (interceptors[endpoint] ?? []) : []),
            ...(callOptions?.interceptors ?? [])
          ]
        })
      },
      request: (parameters: Record<string, unknown>, callOptions = {}): Promise<Record<string, unknown>> => {
        return methods.call(parameters, callOptions)
      },
      emptyRequestParameters: () => {
        const schema = endpointObject(endpoint).request.toJSONSchema()
        return buildInitialValue(schema) as any
      }
    }
    return methods
  }

  return Object.assign(function api (
    endpoint: string | EndpointSchemaUnknown,
    parameters?: CallParameters<Record<string, unknown>, Record<string, unknown>>,
    callOptions?: Options
  ): any {
    const callable = cast(endpoint)

    if (parameters) {
      return callable.call(parameters, callOptions)
    }

    return callable
  }, {
    addInterceptor (key: any, interceptor: any): void {
      if (!interceptors[key]) {
        interceptors[key] = []
      }
      interceptors[key].push(interceptor)
    }
  })
}
