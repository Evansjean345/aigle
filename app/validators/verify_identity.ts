import vine from '@vinejs/vine'

export const createIdentityValidator = vine.compile(
  vine.object({
    doc_recto: vine.string().trim(),
    doc_verso: vine.string().trim(),
    pofile: vine.string().trim(),
    type: vine.string().trim(),
  })
)
