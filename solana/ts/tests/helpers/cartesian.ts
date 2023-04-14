//taken from here: https://github.com/ehmicky/fast-cartesian (also Apache 2.0)
//including as a package didn't work for god knows what reason but resulted in
// TypeError: Unknown file extension ".ts" when running ts-mocha ¯\_(ツ)_/¯

const validateInputs = (inputs: Inputs) => {
  if (!Array.isArray(inputs)) {
    throw new TypeError('Argument must be an array of arrays')
  }

  inputs.forEach(validateInput)
  validateDimensions(inputs)
  validateCombinations(inputs)
}

const validateInput = (input: Input) => {
  if (!Array.isArray(input)) {
    throw new TypeError(`Argument must be an array: ${input}`)
  }
}

const validateDimensions = ({ length }: Inputs) => {
  if (length >= MAX_DIMENSIONS) {
    throw new TypeError(
      `Too many arrays (${length}): please use the 'big-cartesian' library instead`,
    )
  }
}

const MAX_DIMENSIONS = 1e2

// Max array size in JavaScript. This is the limit of the final return value.
const validateCombinations = (inputs: Inputs) => {
  const size = inputs.reduce(multiplySize, 1)

  if (size >= MAX_SIZE) {
    const sizeStr = Number.isFinite(size) ? ` (${size.toExponential(0)})` : ''
    throw new TypeError(
      `Too many combinations${sizeStr}: please use the 'big-cartesian' library instead`,
    )
  }
}

const multiplySize = (size: number, input: Input) => size * input.length

// eslint-disable-next-line @typescript-eslint/no-magic-numbers
const MAX_SIZE = 2 ** 32

type Input = readonly unknown[]
type Inputs = readonly Input[]

type CartesianProduct<InputArrays extends Inputs> =
  InputArrays extends readonly []
    ? []
    : {
        [index in keyof InputArrays]: InputArrays[index] extends readonly (infer InputElement)[]
          ? InputElement
          : never
      }[]

const getLoopFunc = (length: number) => {
  const cachedLoopFunc = cache[length]

  if (cachedLoopFunc !== undefined) {
    return cachedLoopFunc
  }

  const loopFunc = mGetLoopFunc(length)
  // eslint-disable-next-line fp/no-mutation
  cache[length] = loopFunc
  return loopFunc
}

const cache: { [key: number]: LoopFunction } = {}

const mGetLoopFunc = (length: number) => {
  const indexes = Array.from({ length }, getIndex)
  const start = indexes
    .map((index) => `for (const value${index} of arrays[${index}]) {`)
    .join('\n')
  const middle = indexes.map((index) => `value${index}`).join(', ')
  const end = '}\n'.repeat(length)

  // eslint-disable-next-line no-new-func, @typescript-eslint/no-implied-eval
  return new Function(
    'arrays',
    'result',
    `${start}\nresult.push([${middle}])\n${end}`,
  ) as LoopFunction
}

const getIndex = (value: undefined, index: number) => String(index)

type LoopFunction = (arrays: Inputs, result: unknown[]) => void

export const cartesianProd = <InputArrays extends Inputs>(
  inputs: readonly [...InputArrays],
) => {
  validateInputs(inputs)
  const result = [] as CartesianProduct<InputArrays>

  if (inputs.length === 0) {
    return result
  }

  const loopFunc = getLoopFunc(inputs.length)
  loopFunc(inputs, result)
  return result
}