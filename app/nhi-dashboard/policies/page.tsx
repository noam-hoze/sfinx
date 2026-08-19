import { redirect } from 'next/navigation';

export default function LegacyPoliciesPage() {
  redirect('/admin/policies');
}
