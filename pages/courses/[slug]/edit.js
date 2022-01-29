import { useSession } from 'next-auth/react';
import { useRouter } from 'next/router';
import { useEffect } from 'react';
import { Button, Col, ListGroupItem, Row } from 'react-bootstrap';
import ListGroup from 'react-bootstrap/ListGroup';
import { FaPlus } from 'react-icons/fa';
import { useDispatch, useSelector } from 'react-redux';
import {
  assignPiece,
  fetchActivities,
  fetchEnrollments,
  fetchPieces,
} from '../../../actions';
import AddEditCourse from '../../../components/forms/addEditCourse';
import AddEditStudent from '../../../components/forms/addEditStudent';
import UploadStudents from '../../../components/forms/uploadStudents';
import Layout from '../../../components/layout';

export default function EditCourse() {
  const router = useRouter();
  const { slug } = router.query;
  const enrollments = useSelector((state) => state.enrollments);
  const assignedPieces = useSelector((state) => state.assignedPieces.items[slug]);
  const pieces = useSelector((state) => state.pieces);
  const dispatch = useDispatch();
  const { data: session } = useSession();
  useEffect(() => {
    if (session) {// && !enrollments.loaded) {
      dispatch(fetchEnrollments(session.djangoToken));
    }
    if (session) {// && !assignedPieces.loaded) {
      dispatch(fetchActivities({ token: session.djangoToken, slug }));
    }
    if (session) {// && !pieces.loaded) {
      dispatch(fetchPieces(session.djangoToken));
    }
  }, [slug, session, dispatch]);

  const selectedEnrollment = enrollments.items.filter((enrollment) => {
    console.log('enrollment in filter', enrollment, slug);
    console.log(enrollment.course.slug === slug);
    return enrollment.course.slug === slug;
  })[0];
  console.log('pieces', pieces);
  console.log('pieces.items', pieces.items);

  return (
    <Layout>
      <h1>Edit {selectedEnrollment?.course?.name}</h1>

      <AddEditCourse session={session} />
      <AddEditStudent session={session} />
      <UploadStudents session={session} />
    </Layout>
  );
}