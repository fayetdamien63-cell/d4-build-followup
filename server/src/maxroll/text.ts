// Rendu (simplifié) des gabarits de texte du jeu utilisés dans les données Maxroll.
// Exemples : "+[{value}*100|1%|] Critical Strike Chance", "Gain [Affix_Value_1|%+|] Life",
// "{c_important}Sigil{/c}", "{if:IsMythic}...{/if}", "|4Charge:Charges;".

export type TemplateVars = Record<string, number | string | undefined>

const SAFE_EXPR = /^[\d\s.+\-*/()]+$/

export function formatNumber(n: number): string {
  if (!Number.isFinite(n)) return '#'
  const rounded = Math.round(n * 100) / 100
  return Number.isInteger(rounded) ? rounded.toLocaleString('en-US') : rounded.toLocaleString('en-US', { maximumFractionDigits: 2 })
}

/** Évalue une expression arithmétique après substitution des variables ; `null` si impossible. */
export function evalExpr(expr: string, vars: TemplateVars): number | string | null {
  let e = expr.replace(/\{(\w+)\}/g, (_, name: string) => {
    const v = vars[name]
    return v === undefined ? '§' : String(v)
  })
  e = e.replace(/Affix_Value_(\d+)/g, (_, n: string) => {
    const v = vars[`Affix_Value_${n}`]
    return v === undefined ? '§' : String(v)
  })
  // Valeur textuelle (ex: nom d'élément) : renvoyée telle quelle.
  const trimmed = e.trim()
  if (/^[A-Za-z][A-Za-z '-]*$/.test(trimmed)) return trimmed
  e = e.replace(/Floor\(/g, '(').replace(/Ceil\(/g, '(').replace(/Round\(/g, '(')
  if (!SAFE_EXPR.test(e)) return null
  try {
    const result = Function(`"use strict"; return (${e});`)() as unknown
    return typeof result === 'number' && Number.isFinite(result) ? result : null
  } catch {
    return null
  }
}

function applyFormat(value: number | string, fmt: string): string {
  if (typeof value === 'string') return value
  const text = formatNumber(value)
  const prefix = fmt.includes('+') && value >= 0 ? '+' : ''
  let suffix = ''
  if (fmt.includes('%')) suffix += '%'
  if (fmt.includes('x')) suffix += '[x]'
  return prefix + text + suffix
}

/** Résout les blocs {if:COND}…{else}…{/if} (imbriqués) en gardant la branche "par défaut". */
export function resolveConditionals(input: string, isTrue: (cond: string) => boolean = () => false): string {
  let out = ''
  let i = 0
  while (i < input.length) {
    const start = input.indexOf('{if:', i)
    if (start === -1) return out + input.slice(i)
    out += input.slice(i, start)
    const condEnd = input.indexOf('}', start)
    const cond = input.slice(start + 4, condEnd)
    // Recherche du {else} et du {/if} correspondants en tenant compte de l'imbrication.
    let depth = 1
    let j = condEnd + 1
    let elseAt = -1
    let endAt = input.length
    while (j < input.length) {
      const next = input.slice(j).search(/\{if:|\{else\}|\{\/if\}/)
      if (next === -1) break
      const pos = j + next
      if (input.startsWith('{if:', pos)) depth++
      else if (input.startsWith('{else}', pos)) {
        if (depth === 1 && elseAt === -1) elseAt = pos
      } else if (--depth === 0) {
        endAt = pos
        break
      }
      j = pos + 1
    }
    const thenPart = input.slice(condEnd + 1, elseAt === -1 ? endAt : elseAt)
    const elsePart = elseAt === -1 ? '' : input.slice(elseAt + 6, endAt)
    out += resolveConditionals(isTrue(cond) ? thenPart : elsePart, isTrue)
    i = Math.min(endAt + 5, input.length)
  }
  return out
}

export function renderTemplate(template: string, vars: TemplateVars = {}): string {
  let out = resolveConditionals(template.replace(/\r?\n/g, ' '))
  // Valeurs : [expr|format|]
  out = out.replace(/\[([^\[\]|]*)\|([^|\]]*)\|\]/g, (_, expr: string, fmt: string) => {
    const v = evalExpr(expr, vars)
    return v === null ? '#' : applyFormat(v, fmt)
  })
  // Variables hors crochets : "{value1} Resistance"
  out = out.replace(/\{(value\d?)\}/g, (_, name: string) => {
    const v = vars[name]
    return v === undefined ? '' : typeof v === 'number' ? formatNumber(v) : v
  })
  // Pluriels "|4Charge:Charges;"
  out = out.replace(/\|\d*([^:|;]+):([^;]+);/g, '$2')
  // Balises de style et icônes
  out = out.replace(/\{icon:[^}]*\}/g, '').replace(/\{\/?[a-z_]+[^}]*\}/gi, '')
  out = out.replace(/\\\[(.)\\\]/g, '[$1]')
  return out.replace(/\s+/g, ' ').replace(/\s+([.,])/g, '$1').trim()
}

/** "Rune_Effect_Druid_EarthenBulwark" -> "Earthen Bulwark" ; "S15_SoulSplinter_Duriel_04" -> "Soul Splinter Duriel" */
export function prettifyId(id: string): string {
  return id
    .replace(/^S\d+_/, '')
    .replace(/_\d+$/, '')
    .split('_')
    .filter((p) => !['Unique', 'Legendary', 'Generic', 'Rune', 'Effect', 'Condition', 'Talisman'].includes(p))
    .join(' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .trim() || id
}
