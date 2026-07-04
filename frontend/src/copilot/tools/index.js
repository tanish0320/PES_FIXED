import { graphTools } from './graphTools';
import { navigationTools } from './navigationTools';
import { filterTools } from './filterTools';
import { investigationTools } from './investigationTools';

export const copilotTools = {
  ...graphTools,
  ...navigationTools,
  ...filterTools,
  ...investigationTools
};

export default copilotTools;
