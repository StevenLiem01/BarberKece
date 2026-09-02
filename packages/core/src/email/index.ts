export {
  type EmailPort,
  type EmailMessage,
  type SendEmailResult,
} from "./ports/email-port.js";

export {
  EmailError,
  InvalidEmailAddressError,
  InvalidEmailSubjectError,
  MissingEmailContentError,
  EmailDeliveryError,
} from "./errors.js";
