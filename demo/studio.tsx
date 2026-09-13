import { createRoot } from 'react-dom/client';
import { StudioExample } from './StudioExample';

const container = document.getElementById('root');
if (!container) throw new Error('#root not found');

createRoot(container).render(<StudioExample />);
