import vine from '@vinejs/vine'

/** Période de la courbe d'activité. Les deux bornes sont requises. */
export const accountActivityChartValidator = vine.create(
  vine.object({
    start_date: vine.date({ formats: ['YYYY-MM-DD'] }),
    end_date: vine.date({ formats: ['YYYY-MM-DD'] }),
  })
)
