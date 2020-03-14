import { endpointSchema } from '@japan-d2/schema-api-endpoint'
import { apiFactory } from '../src'
import { CallOptions } from '../src/interfaces'

describe('apiFactory', () => {
  const endpoint = {
    ...endpointSchema({
      request: {
        query: d => d.string('message', {
          pattern: '^hello'
        }),
        headers: d => d.string('authorization').string('host')
      },
      response: {
        body: d => d.string('message'),
        headers: d => d.const('content-type', 'application/json')
      }
    }),
    url: 'https://httpbin.org',
    method: 'get'
  } as const

  it('should callable api returns', () => {
    const api = apiFactory({}, {}, async () => {
      return {
        statusCode: 200,
        body: {
          message: 'hello!'
        },
        headers: {
          'content-type': 'application/json'
        }
      }
    })

    expect(api).toBeInstanceOf(Function)
  })

  describe('default options', () => {
    describe('relax call type', () => {
      const options = {
        headers: {
          authorization: '1234'
        }
      }

      const api = apiFactory(options, {}, async () => {
        return {
          statusCode: 200,
          body: {
            message: 'hello!'
          },
          headers: {
            'content-type': 'application/json'
          }
        }
      })

      it('should make optional', () => {
        // `authorization` is not required because default options contains `headers.authorization`.
        expect(() => api(endpoint, {
          query: {
            message: 'hello!'
          },
          headers: {
            host: 'host'
          }
        })).not.toThrow()
      })

      // `authorization` is not required, but able to override.
      expect(() => api(endpoint, {
        query: {
          message: 'hello!'
        },
        headers: {
          host: 'host',
          authorization: '1234'
        }
      })).not.toThrow()
    })
  })

  describe('api', () => {
    const consoleOutput: string[] = []
    const mockedWarn = (output: string): void => {
      consoleOutput.push(output)
    }
    beforeEach(() => {
      console.warn = mockedWarn
      consoleOutput.splice(0, consoleOutput.length)
    })

    it('should callable successfully', async () => {
      const api = apiFactory({}, {}, async () => {
        return {
          statusCode: 200,
          body: {
            message: 'hello!'
          },
          headers: {
            'content-type': 'application/json'
          }
        }
      })

      // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
      const call = async () => {
        return api(endpoint, {
          query: {
            message: 'hello!'
          },
          headers: {
            authorization: '1234',
            host: 'host'
          }
        })
      }

      await expect(call).not.toThrow()
      await expect(call()).resolves.toStrictEqual({
        body: {
          message: 'hello!'
        },
        headers: {
          'content-type': 'application/json'
        },
        statusCode: 200
      })
      expect(consoleOutput).toEqual([])
    })

    describe('request validation', () => {
      const api = apiFactory({
        validateRequest: {
          throwError: true
        }
      }, {}, async () => {
        return {
          statusCode: 200,
          body: {
            message: 'hello!'
          },
          headers: {
            'content-type': 'application/json'
          }
        }
      })

      // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
      const call = async (options: CallOptions = {}) => {
        return api(endpoint, {
          query: {
            message: 'good morning!'
          },
          headers: {
            authorization: '1234',
            host: 'host'
          }
        }, options)
      }

      it('should validate successfully', async () => {
        await expect(call()).rejects.toEqual({
          property: 'instance.queryStringParameters.message',
          message: 'does not match pattern "^hello"',
          schema: { type: 'string', pattern: '^hello' },
          instance: 'good morning!',
          name: 'pattern',
          argument: '^hello',
          stack: 'instance.queryStringParameters.message does not match pattern "^hello"'
        })
        expect(consoleOutput).toEqual([])
      })

      it('should validate successfully without throw', async () => {
        await expect(call({ validateRequest: { throwError: false } })).resolves.toBeTruthy()
        expect(consoleOutput).toEqual(['[api] request parameter validation failed.'])
      })
    })

    describe('response validation', () => {
      const api = apiFactory({
        validateResponse: {
          throwError: true
        }
      }, {}, async () => {
        return {
          statusCode: 200,
          body: {
            message: 'hello!'
          },
          headers: {
            'content-type': 'application/json+x'
          }
        }
      })

      // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
      const call = async (options: CallOptions = {}) => {
        return api(endpoint, {
          query: {
            message: 'hello!'
          },
          headers: {
            authorization: '1234',
            host: 'host'
          }
        }, options)
      }

      it('should validate successfully', async () => {
        await expect(call()).rejects.toEqual({
          property: 'instance.headers.content-type',
          message: 'does not exactly match expected constant: application/json',
          schema: { const: 'application/json' },
          instance: 'application/json+x',
          name: 'const',
          argument: 'application/json',
          stack: 'instance.headers.content-type does not exactly match expected constant: application/json'
        })
        expect(consoleOutput).toEqual([])
      })

      it('should validate successfully without throw', async () => {
        await expect(call({ validateResponse: { throwError: false } })).resolves.toBeTruthy()
        expect(consoleOutput).toEqual(['[api] response parameter validation failed.'])
      })
    })
  })
})

describe('apiFactory with endpoints', () => {
  const endpoints = {
    'test.hello': {
      ...endpointSchema({
        request: {
          query: d => d.string('message', {
            pattern: '^hello'
          }),
          headers: d => d.string('authorization').string('host')
        },
        response: {
          body: d => d.string('message'),
          headers: d => d.const('content-type', 'application/json')
        }
      }),
      url: 'https://httpbin.org',
      method: 'get'
    }
  } as const

  it('should callable api returns', () => {
    const api = apiFactory({}, endpoints, async () => {
      return {
        statusCode: 200,
        body: {
          message: 'hello!'
        },
        headers: {
          'content-type': 'application/json'
        }
      }
    })

    expect(api).toBeInstanceOf(Function)
  })

  describe('default options', () => {
    describe('relax call type', () => {
      const options = {
        headers: {
          authorization: '1234'
        }
      }

      const api = apiFactory(options, endpoints, async () => {
        return {
          statusCode: 200,
          body: {
            message: 'hello!'
          },
          headers: {
            'content-type': 'application/json'
          }
        }
      })

      it('should make optional', () => {
        // `authorization` is not required because default options contains `headers.authorization`.
        expect(() => api('test.hello', {
          query: {
            message: 'hello!'
          },
          headers: {
            host: 'host'
          }
        })).not.toThrow()
      })

      // `authorization` is not required, but able to override.
      expect(() => api('test.hello', {
        query: {
          message: 'hello!'
        },
        headers: {
          host: 'host',
          authorization: '1234'
        }
      })).not.toThrow()
    })
  })

  describe('api', () => {
    const consoleOutput: string[] = []
    const mockedWarn = (output: string): void => {
      consoleOutput.push(output)
    }
    beforeEach(() => {
      console.warn = mockedWarn
      consoleOutput.splice(0, consoleOutput.length)
    })

    it('should callable successfully', async () => {
      const api = apiFactory({}, endpoints, async () => {
        return {
          statusCode: 200,
          body: {
            message: 'hello!'
          },
          headers: {
            'content-type': 'application/json'
          }
        }
      })

      // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
      const call = async () => {
        return api('test.hello', {
          query: {
            message: 'hello!'
          },
          headers: {
            authorization: '1234',
            host: 'host'
          }
        })
      }

      await expect(call).not.toThrow()
      await expect(call()).resolves.toStrictEqual({
        body: {
          message: 'hello!'
        },
        headers: {
          'content-type': 'application/json'
        },
        statusCode: 200
      })
      expect(consoleOutput).toEqual([])
    })

    describe('request validation', () => {
      const api = apiFactory({
        validateRequest: {
          throwError: true
        }
      }, endpoints, async () => {
        return {
          statusCode: 200,
          body: {
            message: 'hello!'
          },
          headers: {
            'content-type': 'application/json'
          }
        }
      })

      // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
      const call = async (options: CallOptions = {}) => {
        return api('test.hello', {
          query: {
            message: 'good morning!'
          },
          headers: {
            authorization: '1234',
            host: 'host'
          }
        }, options)
      }

      it('should validate successfully', async () => {
        await expect(call()).rejects.toEqual({
          property: 'instance.queryStringParameters.message',
          message: 'does not match pattern "^hello"',
          schema: { type: 'string', pattern: '^hello' },
          instance: 'good morning!',
          name: 'pattern',
          argument: '^hello',
          stack: 'instance.queryStringParameters.message does not match pattern "^hello"'
        })
        expect(consoleOutput).toEqual([])
      })

      it('should validate successfully without throw', async () => {
        await expect(call({ validateRequest: { throwError: false } })).resolves.toBeTruthy()
        expect(consoleOutput).toEqual(['[api] request parameter validation failed.'])
      })
    })

    describe('response validation', () => {
      const api = apiFactory({
        validateResponse: {
          throwError: true
        }
      }, endpoints, async () => {
        return {
          statusCode: 200,
          body: {
            message: 'hello!'
          },
          headers: {
            'content-type': 'application/json+x'
          }
        }
      })

      // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
      const call = async (options: CallOptions = {}) => {
        return api('test.hello', {
          query: {
            message: 'hello!'
          },
          headers: {
            authorization: '1234',
            host: 'host'
          }
        }, options)
      }

      it('should validate successfully', async () => {
        await expect(call()).rejects.toEqual({
          property: 'instance.headers.content-type',
          message: 'does not exactly match expected constant: application/json',
          schema: { const: 'application/json' },
          instance: 'application/json+x',
          name: 'const',
          argument: 'application/json',
          stack: 'instance.headers.content-type does not exactly match expected constant: application/json'
        })
        expect(consoleOutput).toEqual([])
      })

      it('should validate successfully without throw', async () => {
        await expect(call({ validateResponse: { throwError: false } })).resolves.toBeTruthy()
        expect(consoleOutput).toEqual(['[api] response parameter validation failed.'])
      })
    })
  })
})
