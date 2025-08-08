import {
  ERROR_MESSAGES,
  ERROR_REASONS,
  ERROR_ACTIONS,
  ERROR_ROUTES
} from '../common/constants/error-constants.js'

export const errorController = {
  handler: async (request, h) => {
    try {
      const { error, message } = request.query || {}

      const errorMessage = message || ERROR_MESSAGES.DEFAULT_ERROR
      const showPossibleReasons = !message

      const context = {
        errorType: error || null,
        errorMessage,
        showPossibleReasons,
        pageTitle: ERROR_MESSAGES.PAGE_TITLE,
        possibleReasonsTitle: ERROR_MESSAGES.POSSIBLE_REASONS_TITLE,
        possibleReasons: Object.values(ERROR_REASONS),
        whatYouCanDoTitle: ERROR_MESSAGES.WHAT_YOU_CAN_DO_TITLE,
        errorActions: Object.values(ERROR_ACTIONS),
        retryLink: ERROR_ROUTES.RETRY_PATH,
        retryText: ERROR_MESSAGES.RETRY_LINK_TEXT
      }

      return h.view('error/index', context)
    } catch (err) {
      return h.response(ERROR_MESSAGES.FALLBACK_ERROR)
    }
  }
}
