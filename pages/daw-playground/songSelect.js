import Form from 'react-bootstrap/Form';
import Spinner from 'react-bootstrap/Spinner';
import { useDispatch, useSelector } from 'react-redux';

import { fetchSongs } from '../../actions';

export default function SongSelector({ onChange }) {
  let { items: songs, loaded: songsLoaded } = useSelector(
    (state) => state.songs
  );

  if (!songsLoaded) {
    console.log('loading songs');
    const dispatch = useDispatch();
    songs = dispatch(fetchSongs());
  }

  return songsLoaded ? (
    <Form.Select onChange={(e) => onChange(songs[e.target.value])}>
      {songs &&
        Object.values(songs).map((song, i) => (
          <option key={song.id} value={i}>
            {song.title}
          </option>
        ))}
    </Form.Select>
  ) : (
    <Spinner size="sm" variant="primary" />
  );
}
