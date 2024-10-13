'use client';

import Layout from '../../components/layout';
import DawStd from '../../components/audio/daw/dawStd';
// import { ErrorBoundary } from 'react-error-boundary';

const DawEditorSimple = () => {
  const url = '/sample_audio/uncso-bruckner4-1.mp3';

  return (
    <Layout>
      <DawStd />
    </Layout>
  );
}

export default DawEditorSimple;
