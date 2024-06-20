const hubspot = require("@hubspot/api-client");
const axios = require("axios");

const ACCESS_TOKEN = process.env.ACCESS_TOKEN;
const BASE_API_URL = "https://api.hubapi.com";

// Function to create request options
const createRequestOptions = (path, method = "GET", headers = {}) => {
  return {
    method,
    url: `${BASE_API_URL}${path}`,
    headers: {
      accept: "application/json",
      "content-type": "application/json",
      authorization: `Bearer ${ACCESS_TOKEN}`,
      ...headers,
    },
  };
};

// Function to search invoices by invoice number
const searchInvoices = async (invoiceNumber) => {
  const requestOptions = createRequestOptions(
    "/crm/v3/objects/invoices/search",
    "POST",
  );

  const requestBody = {
    filterGroups: [
      {
        filters: [
          {
            propertyName: "hs_number",
            operator: "EQ",
            value: invoiceNumber,
          },
        ],
      },
    ],
    properties: ["hs_number"],
  };

  try {
    const response = await axios.request({
      ...requestOptions,
      data: requestBody,
    });

    return response.data.results;
  } catch (error) {
    console.error("Error searching for invoices:", error);
    throw error; // Rethrow the error to be caught in the main function
  }
};

exports.main = async (event, callback) => {
  try {
    // Authenticate your client
    const hubspotClient = new hubspot.Client({
      accessToken: ACCESS_TOKEN,
    });

    // Extract the invoice_number and the deal_id from the event input
    const invoice_number = "INV-DRAFT"; //NOTE this field is equivalent to hs_number in the Invoice Object
    const deal_id = "14970798292";

    //const deal_id = event.inputFields.deal_id;
    //const invoice_number = event.inputFields.invoice_id; //TODO: Fix this mistake the invoice_id should be coming as invoice_number

    //Search the invoices by the Number (hs_number) field and then get the object_id of the Invoice NOTE: invoice_number is coming from the form
    const invoices = await searchInvoices(invoice_number);
    if (invoices.length === 0) {
      throw new Error("No invoices found");
    }

    const invoice_id = invoices[0].properties.hs_object_id;

    //NOTE: to assosiate a Deal and Invoice objects we need invoice_id (ObjectId) and deal_id

    //2. Create the association between the contact and the deal
    await hubspotClient.crm.associations.v4.basicApi.create(
      "deal",
      deal_id,
      "invoice",
      invoice_id,
      [
        {
          associationCategory: "HUBSPOT_DEFINED",
          associationTypeId: 176, //Refer the api docs 176 is an association between Deal and Invoice
        },
      ],
    );

    //3. Log success message
    console.log(
      `Successfully associated an Invoice ${invoice_id} with Deal ${deal_id}`,
    );

    //4. Callback with success message
    callback({
      outputFields: {
        message: "Invoice successfully associated with Deal",
      },
    });
  } catch (error) {
    console.log("ERROR ", error);
    callback({
      outputFields: {
        message: "Error occurred while processing invoices",
      },
    });
  }
};
