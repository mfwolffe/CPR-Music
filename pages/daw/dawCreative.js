import * as React from 'react';

import Layout from '../../components/layout';
import DawSimple from '../../components/daw/dawSimple';
import { Button, Form, Modal } from 'react-bootstrap';
import { useQuery, useQueryClient } from 'react-query';

function SongFetch() {
  const [show, setShow] = useState(false);

  const handleClose = () => setShow(false);
  const handleShow = () => setShow(true);



  return (
    <>
      <Button variant="primary" onClick={handleShow}>
        Launch demo modal
      </Button>

      <Modal show={show} onHide={handleClose}>
        <Modal.Header closeButton>
          <Modal.Title>Track Search</Modal.Title>
        </Modal.Header>
        <Modal.Body></Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={handleClose}>
            Close
          </Button>
          <Button variant="primary" onClick={handleClose}>
            Save Changes
          </Button>
        </Modal.Footer>
      </Modal>
    </>
  );
}

export default function DawCreative() {
  const [audioURL, setAudioURL] = useState([]);
  const [audioIndex, setAudioIndex] = useState(0);



  return (
    <Layout>
      <DawSimple />
      <SongFetch />
    </Layout>
  )


}