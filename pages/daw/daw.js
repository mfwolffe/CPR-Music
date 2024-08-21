import * as React from 'react';

import Layout from '../../components/layout';
import DawSimple from '../../components/daw/dawSimple';

// TODO @mfwolffe honestly a flag in DawSimple for creative
//                may be better than a distinct component
//                considering redundancies; what should it switch?
//                  - daw title
//                  - incl. spotify API for track import/export + track select/skip?
//                    - one issue w/ this is minimap doubling
//                    - also wth to do wrt undo/redo stack - should a sample import 
//                      count as an 'edit' or should each sample/track have its own undo/redo stack?
//                  - Spectrogram?
//                  - Gain Envelope?
//                    - as it stands the envelope implementation only has an effect on playback, 
//                      NOT the audio file
//
export default function DawEditorSimple() {
  return (
    <Layout>
      <DawSimple />
    </Layout>
  );
}
