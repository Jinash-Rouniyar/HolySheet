'use client';

import * as React from 'react';
import { SpreadsheetComponent } from '@syncfusion/ej2-react-spreadsheet';

// Syncfusion component styles (client-only module).
import '@syncfusion/ej2-base/styles/material.css';
import '@syncfusion/ej2-inputs/styles/material.css';
import '@syncfusion/ej2-buttons/styles/material.css';
import '@syncfusion/ej2-splitbuttons/styles/material.css';
import '@syncfusion/ej2-lists/styles/material.css';
import '@syncfusion/ej2-navigations/styles/material.css';
import '@syncfusion/ej2-popups/styles/material.css';
import '@syncfusion/ej2-dropdowns/styles/material.css';
import '@syncfusion/ej2-grids/styles/material.css';
import '@syncfusion/ej2-spreadsheet/styles/material.css';
import '@syncfusion/ej2-react-spreadsheet/styles/material.css';

import { registerSyncfusionLicense } from '@/lib/syncfusion-license';
import { SpreadsheetAdapter } from '@/agent/SpreadsheetAdapter';
import AgentPanel from './AgentPanel';

registerSyncfusionLicense();

export default function SpreadsheetWorkspace() {
  const ssRef = React.useRef<SpreadsheetComponent>(null);
  const adapter = React.useMemo(
    () => new SpreadsheetAdapter(() => ssRef.current),
    [],
  );
  const [open, setOpen] = React.useState(true);

  return (
    <div style={{ height: '100vh', width: '100%', display: 'flex', overflow: 'hidden' }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <SpreadsheetComponent
          ref={ssRef}
          height="100%"
          width="100%"
          allowOpen={true}
          allowSave={true}
          openUrl="https://services.syncfusion.com/js/production/api/spreadsheet/open"
          saveUrl="https://services.syncfusion.com/js/production/api/spreadsheet/save"
          showFormulaBar={true}
          showRibbon={true}
          allowChart={true}
        />
      </div>
      <AgentPanel adapter={adapter} open={open} onToggle={() => setOpen((o) => !o)} />
    </div>
  );
}
