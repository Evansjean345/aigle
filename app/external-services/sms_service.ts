import { makeRequest } from '../helpers/http_helpers.js'

export async function sendSms(message: string, destinataire: string) {
  try {
    // const data = `username=${process.env.MTARGET_USERNAME}&password=${process.env.MTARGET_PASSWORD}&msisdn=${'00225' + destinataire}&msg=${message}`
    const data = {
      username: process.env.MTARGET_USERNAME,
      password: process.env.MTARGET_PASSWORD,
      msisdn: '+225' + destinataire,
      sender: process.env.MTARGET_SENDER,
      msg: message,
      allowunicode: true,
    }

    const encodedData = new URLSearchParams(data).toString()

    console.log(encodedData)

    const uri = process.env.MTARGET_URL
    const method = 'POST'

    const headers = {
      'Content-Type': 'application/x-www-form-urlencoded',
    }

    const response = await makeRequest({
      uri: uri,
      method: method,
      headers: headers,
      data: encodedData,
    })

    return response
  } catch (error) {
    return error
  }
}
