import { HttpContext } from "@adonisjs/core/http";

export default class DepositController {
    constructor() {}

    async handle({request, response}: HttpContext) {
        return response.ok({message: "Deposit endpoint is under construction."});
    }
}