/** Manual progress items that store an optional date in `valuePayload` via progress-tracker PUT */
export const PROGRESS_DATE_PAYLOAD: Partial<Record<string, string>> = {
  am_communication: 'nextMeetingDate',
  am_face_to_face: 'nextF2fMeetingDate',
  am_confirm_start: 'confirmedTelesalesStartDate',
}
