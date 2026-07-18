import type { Dispatch, SetStateAction } from 'react';
import { Linking } from 'react-native';

import type { EventDataKey, EventDataState, EventDetailsTab, EventPagingState } from '../eventDetailsData';
import type { EventRow, VisibleKey } from '../eventDetailsTypes';
import type { useEventSimpleActions } from '../useEventSimpleActions';
import { NotesTab } from './NotesTab';
import { TeamTab } from './TeamTab';
import { TablesTab } from './TablesTab';
import { InvitesTab } from './InvitesTab';
import { ReceptionTab } from './ReceptionTab';
import { ClientPortalTab } from './ClientPortalTab';
import { PresentsTab } from './PresentsTab';
import { AnalyticsTab } from './AnalyticsTab';
import type { EventGift } from '../useEventGifts';

type SimpleFormState = {
  a: string;
  b: string;
  c: string;
  inviteTemplate: string;
  inviteDress: string;
};

type SimpleEventTabsProps = {
  activeTab: EventDetailsTab;
  eventId: string;
  event: EventRow | null;
  data: EventDataState;
  form: SimpleFormState;
  setForm: Dispatch<SetStateAction<any>>;
  composer: EventDetailsTab | null;
  setComposer: Dispatch<SetStateAction<EventDetailsTab | null>>;
  uploadingTeamMemberId: string | null;
  uploadingInviteImage: boolean;
  onUploadTeamPhoto: (member: any) => void;
  onUploadInviteImage: () => void;
  guestSummary: { pending: number; confirmed: number; declined: number };
  visibleGuests: any[];
  filteredGuestCount: number;
  visible: Record<VisibleKey, number>;
  guestSearch: string;
  setGuestSearch: Dispatch<SetStateAction<string>>;
  guestFilter: string;
  setGuestFilter: (value: any) => void;
  paging: EventPagingState;
  loadingMore: EventDataKey | null;
  onShowMoreGuests: () => void;
  onLoadMoreGuests: () => void;
  onError: (message: string) => void;
  onManageDirectory: () => void;
  onOpenPortal: () => void;
  onOpenTeam: () => void;
  actions: ReturnType<typeof useEventSimpleActions>;
  gifts: EventGift[];
  loadingGifts: boolean;
};

export function SimpleEventTabs(props: SimpleEventTabsProps) {
  const {
    activeTab,
    eventId,
    event,
    data,
    form,
    setForm,
    composer,
    setComposer,
    uploadingTeamMemberId,
    uploadingInviteImage,
    onUploadTeamPhoto,
    onUploadInviteImage,
    guestSummary,
    visibleGuests,
    filteredGuestCount,
    visible,
    guestSearch,
    setGuestSearch,
    guestFilter,
    setGuestFilter,
    paging,
    loadingMore,
    onShowMoreGuests,
    onLoadMoreGuests,
    onError,
    onManageDirectory,
    onOpenPortal,
    onOpenTeam,
    actions,
    gifts,
    loadingGifts,
  } = props;

  return (
    <>
      {activeTab === 'notes' && (
        <NotesTab
          notes={data.notes}
          composerOpen={composer === 'notes'}
          draft={form.a}
          onDraftChange={(value) => setForm((current: any) => ({ ...current, a: value }))}
          onOpenComposer={() => setComposer('notes')}
          onCloseComposer={() => setComposer(null)}
          onDelete={(noteId) => void actions.deleteNote(noteId)}
          onCreate={() => void actions.createNote()}
        />
      )}
      {activeTab === 'team' && (
        <TeamTab
          members={data.team}
          directory={actions.teamDirectory}
          composerOpen={composer === 'team'}
          draft={{ name: form.a, phone: form.b, role: form.c }}
          uploadingMemberId={uploadingTeamMemberId}
          onDraftChange={(field, value) => setForm((current: any) => ({
            ...current,
            [field === 'name' ? 'a' : field === 'phone' ? 'b' : 'c']: value,
          }))}
          onOpenComposer={() => setComposer('team')}
          onCloseComposer={() => setComposer(null)}
          onManageDirectory={onManageDirectory}
          onAssignDirectoryMembers={(team, members) => void actions.assignDirectoryMembers(team, members)}
          onUploadPhoto={onUploadTeamPhoto}
          onDelete={(memberId) => void actions.deleteTeamMember(memberId)}
          onCreate={() => void actions.createTeamMember()}
        />
      )}
      {activeTab === 'tables' && (
        <TablesTab
          eventId={eventId}
          tables={data.tables}
          guests={data.guests}
          composerOpen={composer === 'tables'}
          draft={{ name: form.a, seats: form.b }}
          onDraftChange={(field, value) => setForm((current: any) => ({ ...current, [field === 'name' ? 'a' : 'b']: value }))}
          onOpenComposer={() => setComposer('tables')}
          onCloseComposer={() => setComposer(null)}
          onAllocateNext={(tableId) => void actions.allocateNextGuest(tableId)}
          onDelete={(tableId) => void actions.deleteTable(tableId)}
          onCreate={() => void actions.createTable()}
          onError={onError}
          onReload={actions.reloadTablesModule}
          onTablePositionLocalUpdate={actions.updateTablePosition}
        />
      )}
      {activeTab === 'invites' && (
        <InvitesTab
          event={event}
          summary={guestSummary}
          guests={visibleGuests}
          filteredCount={filteredGuestCount}
          visibleLimit={visible.guests}
          search={guestSearch}
          filter={guestFilter}
          composerOpen={composer === 'invites'}
          draft={{ template: form.inviteTemplate, dressCode: form.inviteDress }}
          uploadingImage={uploadingInviteImage}
          hasMoreServer={paging.guests.hasMore}
          loadingMore={loadingMore === 'guests'}
          onSearchChange={setGuestSearch}
          onFilterChange={setGuestFilter}
          onDraftChange={(field, value) => setForm((current: any) => ({
            ...current,
            [field === 'template' ? 'inviteTemplate' : 'inviteDress']: value,
          }))}
          onOpenComposer={() => setComposer('invites')}
          onCloseComposer={() => setComposer(null)}
          onUploadImage={onUploadInviteImage}
          onDispatchBulk={() => void actions.dispatchWhatsApp('bulk')}
          onDispatchSingle={(guestId) => void actions.dispatchWhatsApp('single', guestId)}
          onResendQr={(guestId) => void actions.resendGuestQr(guestId)}
          onShareFiltered={() => void actions.shareFilteredInvites()}
          onShareGuest={(guest) => void actions.shareGuestInvite(guest)}
          onShowMore={onShowMoreGuests}
          onLoadMore={onLoadMoreGuests}
          onSaveConfig={() => void actions.saveInviteConfig()}
        />
      )}
      {activeTab === 'reception' && (
        <ReceptionTab
          guests={data.guests}
          team={data.team}
          onOpenScanner={() => void Linking.openURL(`https://app.painelprime.com.br/recepcao/${eventId}`)}
          onOpenTeam={onOpenTeam}
          onSendAccess={(memberId) => void actions.sendReceptionAccess(memberId)}
        />
      )}
      {activeTab === 'portal' && <ClientPortalTab onOpenPortal={onOpenPortal} />}
      {activeTab === 'presentes' && <PresentsTab gifts={gifts} loading={loadingGifts} />}
      {activeTab === 'analytics' && <AnalyticsTab />}
    </>
  );
}
