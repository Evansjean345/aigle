/** Entrées et sorties d'un compte sur une journée. */
export interface DailyAccountActivity {
  /** Jour au format `YYYY-MM-DD`. */
  date: string
  totalIn: number
  totalOut: number
}
