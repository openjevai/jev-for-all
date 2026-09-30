import { OpenRouter } from "@openrouter/sdk"

export interface QuestionChoice {
  type: "choice"
  instructions: string
  criteria: Record<string, string>
}

export interface QuestionNoul {
  type: "noul"
  instructions: string
}

export type Question = QuestionChoice | QuestionNoul

export type Answers = Record<string, unknown>

export type Ask = (input: { state: unknown; questions: Record<string, Question> }) => Promise<Answers>

export type JevProvider = "openrouter" | "openjev"

export interface JevOptions {
  apiKey: string
  model?: string
  serverURL?: string
  timeoutMs?: number
  provider?: JevProvider
  onMeta?: (meta: { model?: string; inputTokens?: number; outputTokens?: number }) => void
}

export class JevError extends Error {
  readonly status?: number

  constructor(message: string, status?: number) {
    super(message)
    this.name = "JevError"
    this.status = status
  }
}

// OpenJEV — free community gateway to the same Jev model (https://openjev.sh).
// Same System One contract as OpenRouter's alpha Decisions API, different endpoint/model/key.
const OPENJEV_ENDPOINT = "https://api.openjev.sh/v1/systemone"

/** Direct HTTP transport for OpenJEV. Used when provider === "openjev". */
function createOpenjevAsk(options: JevOptions): Ask {
  const model = options.model ?? "openjev"
  const timeoutMs = options.timeoutMs ?? 1000
  return async ({ state, questions }) => {
    let response: Response
    try {
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), timeoutMs)
      response = await fetch(OPENJEV_ENDPOINT, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${options.apiKey}`,
        },
        body: JSON.stringify({ model, state: state as never, questions }),
        signal: controller.signal,
      })
      clearTimeout(timer)
    } catch (error) {
      throw new JevError(
        `jev-for-all request failed: ${error instanceof Error ? error.message : String(error)}`,
        undefined,
      )
    }
    if (!response.ok) {
      throw new JevError(`jev-for-all request failed: HTTP ${response.status}`, response.status)
    }
    const body = (await response.json()) as Record<string, unknown>
    const answers = body.answers
    if (!answers || typeof answers !== "object") throw new JevError("jev-for-all response missing answers")
    const usage = body.usage as { inputTokens?: unknown; outputTokens?: unknown } | undefined
    options.onMeta?.({
      model: typeof body.model === "string" ? body.model : undefined,
      inputTokens: typeof usage?.inputTokens === "number" ? usage.inputTokens : undefined,
      outputTokens: typeof usage?.outputTokens === "number" ? usage.outputTokens : undefined,
    })
    return answers as Answers
  }
}

export function createJev(options: JevOptions): Ask {
  if (options.provider === "openjev") {
    return createOpenjevAsk(options)
  }
  const model = options.model ?? "~typesafe/jev-latest"
  const client = new OpenRouter({ apiKey: options.apiKey })

  return async ({ state, questions }) => {
    let response: Awaited<ReturnType<typeof client.alpha.decisions.create>>
    try {
      response = await client.alpha.decisions.create(
        { decisionsRequest: { model, state: state as never, questions } },
        {
          timeoutMs: options.timeoutMs ?? 1000,
          retries: { strategy: "none" },
          ...(options.serverURL ? { serverURL: options.serverURL } : {}),
        },
      )
    } catch (error) {
      const status = (error as { statusCode?: number }).statusCode
      throw new JevError(
        `jev-for-all request failed: ${error instanceof Error ? error.message : String(error)}`,
        typeof status === "number" ? status : undefined,
      )
    }
    const answers = response?.answers
    if (!answers || typeof answers !== "object") throw new JevError("jev-for-all response missing answers")
    const resolved = (response as { model?: unknown }).model
    const usage = (response as { usage?: { inputTokens?: unknown; outputTokens?: unknown } }).usage
    options.onMeta?.({
      model: typeof resolved === "string" ? resolved : undefined,
      inputTokens: typeof usage?.inputTokens === "number" ? usage.inputTokens : undefined,
      outputTokens: typeof usage?.outputTokens === "number" ? usage.outputTokens : undefined,
    })
    return answers as Answers
  }
}

export interface ChoiceAnswer {
  choice: string
  probabilities: Record<string, number>
  confidence?: number
}

export interface NoulAnswer {
  noul: number
}

export function asChoice(value: unknown): ChoiceAnswer | null {
  if (!value || typeof value !== "object") return null
  const candidate = value as { type?: unknown; choice?: unknown; probabilities?: unknown; confidence?: unknown }
  if (candidate.type !== "choice" || typeof candidate.choice !== "string") return null
  const probabilities: Record<string, number> = {}
  if (candidate.probabilities && typeof candidate.probabilities === "object") {
    for (const [key, probability] of Object.entries(candidate.probabilities as Record<string, unknown>)) {
      if (typeof probability === "number" && Number.isFinite(probability)) probabilities[key] = probability
    }
  }
  return {
    choice: candidate.choice,
    probabilities,
    confidence: typeof candidate.confidence === "number" ? candidate.confidence : undefined,
  }
}

export function asNoul(value: unknown): NoulAnswer | null {
  if (!value || typeof value !== "object") return null
  const candidate = value as { type?: unknown; noul?: unknown }
  if (candidate.type !== "noul" || typeof candidate.noul !== "number" || !Number.isFinite(candidate.noul)) return null
  return { noul: candidate.noul }
}
