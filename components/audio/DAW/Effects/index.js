'use client';

import { useEffects } from '../../../../contexts/DAWProvider';
import EQ from './EQ';
import Echo from './Echo';
import Reverb from './Reverb';
import Chorus from './Chorus';

// Width calculations for effects panels
const EQWIDTH = 28;
const ECHOWIDTH = 13;
const REVERBWIDTH = 15;
const CHRWIDTH = 18;

/**
 * Container for all effects panels
 * Only renders the effects that are currently visible
 */
export default function Effects() {
  const { eqPresent, rvbPresent, reverbPresent, chrPresent } = useEffects();
  
  return (
    <>
      {eqPresent && <EQ width={EQWIDTH} />}
      {rvbPresent && <Echo width={ECHOWIDTH} />}
      {reverbPresent && <Reverb width={REVERBWIDTH} />}
      {chrPresent && <Chorus width={CHRWIDTH} />}
    </>
  );
}