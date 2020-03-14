import { validate, Options as ValidateOptions } from 'jsonschema'
import { Options, Connector, CallParameters, EndpointSchema, CallOptions } from './interfaces'
import { Dirty, Pure } from '@japan-d2/schema'
import { SchemaDefinition } from '@japan-d2/schema/lib/interfaces'

export * from './interfaces'

type EndpointMap = Record<string, EndpointSchema<{}, {}>>

interface EndpointCallable <T, U, O> {
  validate (parameters: Dirty<SchemaDefinition<T>>): parameters is Pure<SchemaDefinition<T>>;
  assertValid (parameters: Dirty<SchemaDefinition<T>>): asserts parameters is Pure<SchemaDefinition<T>>;
  call (parameters: CallParameters<T, O>, callOptions?: CallOptions): Promise<U>;
}

interface APICallable <O, E extends EndpointMap = {}> {
  <T, U>(
    endpoint: EndpointSchema<T, U>,
  ): EndpointCallable<T, U, O>;

  <K extends keyof E, S extends EndpointSchema<{}, {}> = E[K]>(
    endpoint: K,
  ): EndpointCallable<ReturnType<S['request']['getType']>, ReturnType<S['response']['getType']>, O>;

  <T, U>(
    endpoint: EndpointSchema<T, U>,
    parameters: CallParameters<T, O>,
    callOptions?: CallOptions
  ): Promise<U>;

  <K extends keyof E, S extends EndpointSchema<{}, {}> = E[K]>(
    endpoint: K,
    parameters: CallParameters<ReturnType<S['request']['getType']>, O>,
    callOptions?: CallOptions
  ): Promise<ReturnType<S['response']['getType']>>;
}

export function apiFactory <O extends Options, E extends EndpointMap> (defaultOptions: O, endpoints: E, connector: Connector): APICallable<O, E> {
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

    const response = await connector({
      url: endpoint.url,
      method: endpoint.method,
      query,
      headers,
      body
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

  function endpointObject (endpoint: any): EndpointSchema<{}, {}> {
    if (typeof endpoint === 'string') {
      return endpoints[endpoint]
    }
    return endpoint
  }

  function cast (endpoint: string | EndpointSchema<{}, {}>): EndpointCallable<{}, {}, O> {
    return {
      validate: (parameters: any, options?: Omit<ValidateOptions, 'throwError'>): parameters is {} => {
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
      call: (parameters: {}, callOptions = {}): Promise<{}> => {
        return call(endpointObject(endpoint), parameters, callOptions)
      }
    }
  }

  return function api (
    endpoint: string | EndpointSchema<{}, {}>,
    parameters?: CallParameters<{}, {}>,
    callOptions?: Options
  ): any {
    const callable = cast(endpoint)

    if (parameters) {
      return callable.call(parameters, callOptions)
    }

    return callable
  }
}
