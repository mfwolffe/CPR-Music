'use client';

import { useEffects } from '../../../../contexts/DAWProvider';
import EQ from './EQ';
import Reverb from './Reverb';
import Chorus from './Chorus';

// Width calculations for effects panels
const EQWIDTH = 28;
const RVBWIDTH = 13;
const CHRWIDTH = 18;

/**
 * Container for all effects panels
 * Only renders the effects that are currently visible
 */
export default function Effects() {
  const { eqPresent, rvbPresent, chrPresent } = useEffects();
  
  return (
    <>
      {eqPresent && <EQ width={EQWIDTH} />}
      {rvbPresent && <Reverb width={RVBWIDTH} />}
      {chrPresent && <Chorus width={CHRWIDTH} />}
    </>
  );
}