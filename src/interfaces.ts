import { EndpointRequest, EndpointSchema as EndpointSchemaRaw, EndpointResponse } from '@japan-d2/schema-api-endpoint'
import { Options as JsonSchemaValidateOptions } from 'jsonschema'
import { Dirty, Pure } from '@japan-d2/schema'
import { SchemaDefinition } from '@japan-d2/schema/lib/interfaces'

export interface EndpointSchema <T, U> extends EndpointSchemaRaw<T, U> {
  url: string;
  method: 'get' | 'post' | 'put' | 'patch' | 'delete';
}

export type Json =
  | string
  | number
  | boolean
  | null
  | { [property: string]: Json }
  | Json[];

export interface RequestParameter {
  url: string;
  method: 'get' | 'post' | 'put' | 'patch' | 'delete';
  query: Record<string, string | string[]>;
  body: Record<string, Json>;
  headers: Record<string, string>;
  schema: EndpointSchema<unknown, unknown>;
}

export interface ResponseParameter {
  statusCode: number;
  body: Record<string, Json>;
  headers: Record<string, string>;
}

export type CastOptions = Partial<{
  preprocessors: Partial<{
    validation: Partial<{
      request: (input: { query: unknown; headers: unknown; body: unknown }) => any;
      response: (input: { headers: unknown; body: unknown }) => any;
    }>;
  }>;
}>

export type CallOptions = Partial<{
  validateRequest: JsonSchemaValidateOptions;
  validateResponse: JsonSchemaValidateOptions;
}>
export type Options = Partial<RequestParameter> & CallOptions & CastOptions

type MaskRequired <T, O extends keyof T> = Omit<T, O> & Partial<Pick<T, O>>
type MaskRequiredParameter <T, U, K extends string> = (
  T extends { [Key in K]: Record<string, unknown> }
  ? U extends { [Key in K]: Record<string, unknown> }
    ? MaskRequired<T[K], Extract<keyof T[K], keyof U[K]>>
    : T[K]
  : unknown
)

export type EndpointRequestUnknown = EndpointRequest<unknown, unknown, unknown>
export type EndpointResponseUnknown = EndpointResponse<unknown, unknown>
export type EndpointSchemaUnknown = EndpointSchema<EndpointRequestUnknown, EndpointResponseUnknown>

type Filter<T, F> = Pick<T, ({
  [K in keyof T]: T[K] extends F ? K : never;
})[keyof T]>

export type CallParameters <T extends EndpointRequestUnknown, O extends Options> = (
  Omit<T, 'query' | 'headers'> & Filter<{
    query: MaskRequiredParameter<T, O, 'query'>;
    headers: MaskRequiredParameter<T, O, 'headers'>;
  }, Record<string, unknown>> & {
    query?: Record<string, string | string[]>;
    headers?: Record<string, string>;
  }
)

export type Connector = (parameters: RequestParameter) => Promise<ResponseParameter>

export type EndpointMap = Record<string, EndpointSchemaUnknown>

export interface EndpointCallable <T, U, O> {
  validate (parameters: Dirty<SchemaDefinition<T>>): parameters is Pure<SchemaDefinition<T>>;
  assertValid (parameters: Dirty<SchemaDefinition<T>>): asserts parameters is Pure<SchemaDefinition<T>>;
  call (parameters: CallParameters<T, O>, callOptions?: CallOptions): Promise<U>;
  request (parameters: CallParameters<T, O>, callOptions?: CallOptions): Promise<U>;
  emptyRequestParameters (): Pure<SchemaDefinition<T>>;
}

export interface APICallable <O, E extends EndpointMap = EndpointMap> {
  <T, U>(
    endpoint: EndpointSchema<T, U>,
  ): EndpointCallable<T, U, O>;

  <K extends keyof E, S extends EndpointSchema<unknown, unknown> = E[K]>(
    endpoint: K,
  ): EndpointCallable<Pure<S['request']>, Pure<S['response']>, O>;

  <T, U>(
    endpoint: EndpointSchema<T, U>,
    parameters: CallParameters<T, O>,
    callOptions?: CallOptions
  ): Promise<U>;

  <K extends keyof E, S extends EndpointSchemaUnknown = E[K]>(
    endpoint: K,
    parameters: CallParameters<Pure<S['request']>, O>,
    callOptions?: CallOptions
  ): Promise<Pure<S['response']>>;
}
