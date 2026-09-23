const dateFmt = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })

/** Accepte l'ISO ou le format Maxroll "2026-09-22 22:57:57". */
export function formatDate(value: string | null | undefined): string {
  if (!value) return '—'
  const d = new Date(value.includes('T') ? value : value.replace(' ', 'T') + 'Z')
  return Number.isNaN(d.getTime()) ? value : `le ${dateFmt.format(d)}`
}
