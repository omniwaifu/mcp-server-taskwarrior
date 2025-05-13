/**
 * MCP Response Format Utilities
 * Standardizes response formatting for MCP tools
 */

/**
 * Creates a properly formatted MCP success response
 * @param data The data to send in the response (will be converted to text)
 * @returns A properly formatted MCP success response
 */
export function createMcpSuccessResponse(data: unknown) {
  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(data)
      }
    ]
  };
}

/**
 * Creates a properly formatted MCP error response
 * @param errorMessage The error message
 * @returns A properly formatted MCP error response
 */
export function createMcpErrorResponse(errorMessage: string) {
  return {
    content: [
      {
        type: "text",
        text: JSON.stringify({ error: errorMessage })
      }
    ]
  };
} 