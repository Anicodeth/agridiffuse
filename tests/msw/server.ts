import { setupServer } from "msw/node";
import { handlers, resetMswState } from "./handlers";

export const server = setupServer(...handlers);

export { resetMswState };
