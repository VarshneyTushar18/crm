import './style/app.css';

import { Suspense, lazy } from 'react';
import { BrowserRouter } from 'react-router-dom';
import { Provider } from 'react-redux';
import store from '@/redux/store';
import PageLoader from '@/components/PageLoader';

// ✅ ADD THIS
import { JobProvider } from './context/JobContext';

const IdurarOs = lazy(() => import('./apps/IdurarOs'));

export default function RootApp() {
  return (
    <BrowserRouter>
      <Provider store={store}>

        {/* ✅ IMPORTANT */}
        <JobProvider>

          <Suspense fallback={<PageLoader />}>
            <IdurarOs />
          </Suspense>

        </JobProvider>

      </Provider>
    </BrowserRouter>
  );
}
