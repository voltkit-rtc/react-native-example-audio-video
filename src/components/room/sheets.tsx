import { useAudioOutput, useNetworkQuality, useVoltkitClient, useVoltkitEvent } from '@voltkit-rtc/react-native';
import { useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { ApiError, api } from '../../api/client';
import { VOLTKIT } from '../../config';
import { compact } from '../../lib/format';
import { toast } from '../../lib/toast';
import { canModerate, memberActions, seatActions, type MemberAction } from '../../rtc/permissions';
import { seatNumber } from '../../rtc/seats';
import type { Member, RoomEngine } from '../../rtc/useRoomEngine';
import { useSession } from '../../state/session';
import { colors, radius } from '../../theme';
import type { Role } from '../../types';
import { Avatar, GhostButton, GradientButton, IconName, RoleBadge, Sheet, SheetRow, T } from '../ui';

const REASONS: { id: string; label: string }[] = [
  { id: 'harassment', label: 'Harassment or hate' },
  { id: 'nudity', label: 'Nudity or sexual content' },
  { id: 'violence', label: 'Violence or threats' },
  { id: 'underage', label: 'Appears to be under 18' },
  { id: 'spam', label: 'Spam or scam' },
  { id: 'other', label: 'Something else' },
];

export function ReportSheet({
  target,
  roomId,
  onClose,
}: {
  target: { id: string; name: string } | null;
  roomId?: string;
  onClose: () => void;
}) {
  async function send(reason: string) {
    if (!target) return;
    onClose();
    try {
      await api.report(target.id, reason, roomId);
      toast('Thanks. We have your report.', 'success');
    } catch (err) {
      toast(err instanceof ApiError ? err.message : 'That did not go through.', 'error');
    }
  }
  return (
    <Sheet visible={target !== null} onClose={onClose} title={target ? `Report ${target.name}` : ''} testID="report-sheet">
      {REASONS.map((r) => (
        <SheetRow key={r.id} testID={`report-${r.id}`} icon="flag-outline" label={r.label} onPress={() => send(r.id)} />
      ))}
    </Sheet>
  );
}

const ACTION_LOOK: Record<MemberAction, { icon: IconName; label: string; danger?: boolean }> = {
  'invite-seat': { icon: 'person-add-outline', label: 'Invite to a seat' },
  'remove-seat': { icon: 'arrow-down-circle-outline', label: 'Move to the audience' },
  'force-mute-mic': { icon: 'mic-off-outline', label: 'Switch off their microphone' },
  'release-mic': { icon: 'mic-outline', label: 'Release their microphone' },
  'force-mute-cam': { icon: 'videocam-off-outline', label: 'Switch off their camera' },
  'release-cam': { icon: 'videocam-outline', label: 'Release their camera' },
  'mute-chat': { icon: 'chatbox-ellipses-outline', label: 'Mute in chat' },
  'unmute-chat': { icon: 'chatbox-outline', label: 'Allow in chat' },
  'make-moderator': { icon: 'shield-checkmark-outline', label: 'Make moderator' },
  'remove-moderator': { icon: 'shield-outline', label: 'Remove as moderator' },
  'decline-hand': { icon: 'hand-left-outline', label: 'Decline their request' },
  'remove-from-room': { icon: 'exit-outline', label: 'Remove from the room', danger: true },
};

export function MemberSheet({
  engine,
  identity,
  messageId,
  onClose,
  onGift,
  onReport,
  onMessage,
}: {
  engine: RoomEngine;
  identity: string | null;
  messageId?: string;
  onClose: () => void;
  onGift: (identity: string) => void;
  onReport: (target: { id: string; name: string }) => void;
  onMessage: (identity: string) => void;
}) {
  const client = useVoltkitClient();
  const { guest, refresh } = useSession();
  const { room, myRole, memberById, chatMuted, actions, me } = engine;
  const member = identity ? memberById.get(identity) : undefined;
  const name = member?.name ?? 'Guest';
  const mine = identity === me.id;
  const blocked = identity ? guest?.blocked.includes(identity) : false;

  const list: MemberAction[] =
    member && identity
      ? memberActions(
          myRole,
          {
            role: member.role,
            isSelf: mine,
            seated: Boolean(member.seat),
            handRaised: member.handRaised,
            micLocked: member.micLocked,
            camLocked: member.camLocked,
            chatMuted: chatMuted.has(identity),
          },
          room.type === 'video',
        )
      : [];

  function act(action: MemberAction) {
    if (!identity) return;
    onClose();
    const run: Record<MemberAction, () => unknown> = {
      'invite-seat': () => actions.inviteToSeat(identity),
      'remove-seat': () => actions.removeFromSeat(identity),
      'force-mute-mic': () => actions.forceMic(identity, true),
      'release-mic': () => actions.forceMic(identity, false),
      'force-mute-cam': () => actions.forceCam(identity, true),
      'release-cam': () => actions.forceCam(identity, false),
      'mute-chat': () => actions.setChatMute(identity, true),
      'unmute-chat': () => actions.setChatMute(identity, false),
      'make-moderator': () => actions.makeModerator(identity),
      'remove-moderator': () => actions.removeModerator(identity),
      'decline-hand': () => actions.declineHand(identity),
      'remove-from-room': () => actions.removeFromRoom(identity),
    };
    void run[action]();
  }

  async function toggleBlock() {
    if (!identity) return;
    onClose();
    try {
      if (blocked) await api.unblock(identity);
      else await api.block(identity);
      await refresh();
      toast(blocked ? 'Unblocked' : `${name} is blocked`, 'success');
    } catch (err) {
      toast(err instanceof ApiError ? err.message : 'That did not work.', 'error');
    }
  }

  return (
    <Sheet visible={identity !== null} onClose={onClose} testID="member-sheet">
      <View style={styles.who}>
        <Avatar avatar={member?.avatar} frame={member?.frame} size={52} />
        <View style={{ flex: 1, gap: 3 }}>
          <T variant="heading" numberOfLines={1}>
            {name}
            {mine ? ' (you)' : ''}
          </T>
          <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
            {member && <RoleBadge role={member.role} />}
            {member?.seat && (
              <T variant="tiny" style={{ color: colors.textDim }}>
                Seat {seatNumber(member.seat)}
              </T>
            )}
          </View>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} style={{ flexGrow: 0 }}>
        {list.map((a) => (
          <SheetRow key={a} testID={`action-${a}`} icon={ACTION_LOOK[a].icon} label={ACTION_LOOK[a].label} danger={ACTION_LOOK[a].danger} onPress={() => act(a)} />
        ))}
        {messageId && identity && (canModerate(myRole) || mine) && (
          <SheetRow
            testID="action-delete-message"
            icon="trash-outline"
            label="Delete this message"
            onPress={() => {
              onClose();
              client?.deleteMessage(messageId).catch(() => toast('Could not delete that message.', 'error'));
            }}
          />
        )}
        {identity && (
          <SheetRow
            testID="action-gift"
            icon="gift-outline"
            label={mine ? 'Send yourself a gift' : 'Send a gift'}
            gold
            onPress={() => {
              onClose();
              onGift(identity);
            }}
          />
        )}
        {!mine && identity && (
          <>
            <SheetRow
              testID="action-message"
              icon="chatbubble-ellipses-outline"
              label="Send a message"
              onPress={() => {
                onClose();
                onMessage(identity);
              }}
            />
            <SheetRow
              testID="action-report"
              icon="flag-outline"
              label="Report"
              onPress={() => {
                onClose();
                onReport({ id: identity, name });
              }}
            />
            <SheetRow testID="action-block" icon="ban-outline" label={blocked ? 'Unblock' : 'Block'} danger={!blocked} onPress={toggleBlock} />
          </>
        )}
      </ScrollView>
    </Sheet>
  );
}

export function SeatSheet({ engine, seat, onClose }: { engine: RoomEngine; seat: string | null; onClose: () => void }) {
  const { myRole, claims, locked, mySeat, me, actions, seatMode } = engine;
  if (!seat) return <Sheet visible={false} onClose={onClose}>{null}</Sheet>;
  const list = seatActions(myRole, { empty: !claims[seat], locked: locked.has(seat), mine: claims[seat]?.identity === me.id }, Boolean(mySeat));
  const n = seatNumber(seat);
  return (
    <Sheet visible onClose={onClose} title={`Seat No.${n}`} testID="seat-sheet">
      {list.includes('request') && (
        <SheetRow
          testID="seat-request"
          icon="hand-left-outline"
          label={seatMode === 'open' ? 'Take this seat' : 'Ask for this seat'}
          hint={seatMode === 'open' ? 'You go on stage straight away' : 'The host decides'}
          onPress={() => {
            onClose();
            void actions.requestSeat(seat);
          }}
        />
      )}
      {list.includes('leave') && (
        <SheetRow
          testID="seat-leave"
          icon="exit-outline"
          label="Leave this seat"
          onPress={() => {
            onClose();
            void actions.leaveSeat();
          }}
        />
      )}
      {list.includes('lock') && (
        <SheetRow
          testID="seat-lock"
          icon="lock-closed-outline"
          label="Lock this seat"
          onPress={() => {
            onClose();
            void actions.lockSeat(seat);
          }}
        />
      )}
      {list.includes('unlock') && (
        <SheetRow
          testID="seat-unlock"
          icon="lock-open-outline"
          label="Unlock this seat"
          onPress={() => {
            onClose();
            void actions.unlockSeat(seat);
          }}
        />
      )}
      {list.includes('invite') && (
        <T variant="small" style={{ color: colors.textFaint, paddingVertical: 6 }}>
          To fill this seat, tap someone in the audience list and invite them.
        </T>
      )}
      {list.length === 0 && (
        <T style={{ color: colors.textDim, paddingVertical: 6 }}>{locked.has(seat) ? 'The host has locked this seat.' : 'This seat is not available.'}</T>
      )}
    </Sheet>
  );
}

const roleOrder: Record<Role, number> = { host: 0, moderator: 1, cohost: 2, viewer: 3 };

export function PeopleSheet({
  engine,
  visible,
  onClose,
  onMember,
}: {
  engine: RoomEngine;
  visible: boolean;
  onClose: () => void;
  onMember: (identity: string) => void;
}) {
  const { members, hands, actions, myRole } = engine;
  const canAccept = myRole === 'host';
  const canDecline = canModerate(myRole);
  const sorted = [...members].sort((a, b) => roleOrder[a.role] - roleOrder[b.role]);

  const row = (m: Member) => (
    <Pressable
      key={m.identity}
      testID={`person-${m.identity}`}
      accessibilityRole="button"
      accessibilityLabel={m.name}
      onPress={() => {
        onClose();
        onMember(m.identity);
      }}
      style={styles.person}
    >
      <Avatar avatar={m.avatar} size={38} />
      <View style={{ flex: 1 }}>
        <T variant="medium" numberOfLines={1}>
          {m.name}
        </T>
      </View>
      <RoleBadge role={m.role} />
    </Pressable>
  );

  return (
    <Sheet visible={visible} onClose={onClose} title={`In the room (${members.length})`} testID="people-sheet">
      <ScrollView showsVerticalScrollIndicator={false} style={{ flexGrow: 0 }}>
        {hands.length > 0 && (
          <View style={{ marginBottom: 8 }}>
            <T variant="tiny" style={styles.section}>
              ASKING FOR A SEAT
            </T>
            {hands.map((m) => (
              <View key={m.identity} style={styles.person}>
                <Avatar avatar={m.avatar} size={38} />
                <T variant="medium" numberOfLines={1} style={{ flex: 1 }}>
                  {m.name}
                </T>
                {canDecline && (
                  <Pressable testID={`decline-${m.identity}`} accessibilityRole="button" accessibilityLabel={`Decline ${m.name}`} onPress={() => void actions.declineHand(m.identity)} style={styles.decline}>
                    <T variant="tiny">Decline</T>
                  </Pressable>
                )}
                {canAccept && (
                  <Pressable testID={`accept-${m.identity}`} accessibilityRole="button" accessibilityLabel={`Accept ${m.name}`} onPress={() => void actions.acceptHand(m.identity, m.wantedSeat)} style={styles.accept}>
                    <T variant="tiny" style={{ color: '#201000' }}>
                      Accept
                    </T>
                  </Pressable>
                )}
              </View>
            ))}
          </View>
        )}
        {sorted.map(row)}
      </ScrollView>
    </Sheet>
  );
}

const NETWORK_WORDS: Record<string, string> = { excellent: 'Excellent', good: 'Good', poor: 'Poor', bad: 'Bad' };

export function MoreSheet({
  engine,
  visible,
  onClose,
  onLeave,
  onPeople,
  onReportRoom,
}: {
  engine: RoomEngine;
  visible: boolean;
  onClose: () => void;
  onLeave: () => void;
  onPeople: () => void;
  onReportRoom: () => void;
}) {
  const { isHost, layout, seatMode, actions, room, mySeat, myRole, myHand } = engine;
  const audio = useAudioOutput();
  const network = useNetworkQuality();
  const close = (fn: () => void) => () => {
    onClose();
    fn();
  };

  return (
    <Sheet visible={visible} onClose={onClose} title="Room" testID="more-sheet">
      <ScrollView showsVerticalScrollIndicator={false} style={{ flexGrow: 0 }}>
        <SheetRow icon="people-outline" label="People in the room" onPress={close(onPeople)} testID="more-people" />
        {isHost && room.type === 'video' && (
          <SheetRow
            testID="more-layout"
            icon="grid-outline"
            label={layout === 'stage' ? 'Switch to grid layout' : 'Switch to stage layout'}
            hint="Everyone in the room sees the change"
            onPress={close(() => void actions.setRoomLayout(layout === 'stage' ? 'grid' : 'stage'))}
          />
        )}
        {isHost && (
          <SheetRow
            testID="more-seat-mode"
            icon={seatMode === 'open' ? 'lock-open-outline' : 'hand-left-outline'}
            label={seatMode === 'open' ? 'Require your approval for seats' : 'Let anyone take a seat'}
            onPress={close(() => void actions.setRoomSeatMode(seatMode === 'open' ? 'request' : 'open'))}
          />
        )}
        {isHost && <SheetRow testID="more-mute-all" icon="volume-mute-outline" label="Mute everyone on stage" onPress={close(() => void actions.muteAll())} />}
        {mySeat && <SheetRow testID="more-leave-seat" icon="arrow-down-circle-outline" label="Leave my seat" onPress={close(() => void actions.leaveSeat())} />}
        {myRole === 'viewer' && myHand && <SheetRow icon="hand-left-outline" label="Cancel my request" onPress={close(() => void actions.cancelRequest())} />}
        {audio.supported && audio.outputs.length > 1 && (
          <SheetRow
            icon={audio.speakerphone ? 'volume-high-outline' : 'ear-outline'}
            label={audio.speakerphone ? 'Use the earpiece' : 'Use the loudspeaker'}
            onPress={close(() => void audio.setSpeakerphoneOn(!audio.speakerphone).catch(() => {}))}
          />
        )}
        {network && (
          <SheetRow
            icon="cellular-outline"
            label={`Connection: ${NETWORK_WORDS[network.level] ?? network.level}`}
            hint={network.rttMs != null ? `${Math.round(network.rttMs)} ms round trip` : undefined}
            onPress={onClose}
          />
        )}
        {!isHost && <SheetRow testID="more-report" icon="flag-outline" label="Report this room" onPress={close(onReportRoom)} />}
        <SheetRow icon="flash-outline" gold label={VOLTKIT.poweredBy} hint="A React Native demo. Build yours at voltkit.in" onPress={close(() => void Linking.openURL(VOLTKIT.site))} />
        <SheetRow testID="more-leave" icon="power-outline" danger label={isHost ? 'End the room' : 'Leave the room'} onPress={close(onLeave)} />
      </ScrollView>
    </Sheet>
  );
}

export function ConfirmEndSheet({
  visible,
  isHost,
  onClose,
  onConfirm,
}: {
  visible: boolean;
  isHost: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  return (
    <Sheet visible={visible} onClose={onClose} testID="confirm-end">
      <View style={{ gap: 10 }}>
        <T variant="title">{isHost ? 'End this room?' : 'Leave this room?'}</T>
        <T style={{ color: colors.textDim }}>{isHost ? 'The room closes for everyone in it.' : 'You can come back while it is live.'}</T>
        <GradientButton testID="confirm-end-yes" label={isHost ? 'End the room' : 'Leave'} colorsOverride={['#FB3B66', '#EC4899']} onPress={onConfirm} style={{ marginTop: 6 }} />
        <GhostButton label="Stay" onPress={onClose} />
      </View>
    </Sheet>
  );
}

export function InviteSheet({ engine }: { engine: RoomEngine }) {
  const { invitedTo, actions, room } = engine;
  return (
    <Sheet visible={invitedTo !== null} onClose={actions.declineInvite} testID="invite-sheet">
      <View style={{ gap: 10 }}>
        <T variant="title">The host invited you on stage</T>
        <T style={{ color: colors.textDim }}>
          {room.type === 'video' ? 'Your camera and microphone go live to the room.' : 'Your microphone goes live to the room.'}
        </T>
        <GradientButton testID="invite-accept" label="Join the stage" onPress={() => void actions.acceptInvite()} style={{ marginTop: 6 }} />
        <GhostButton label="No thanks" onPress={actions.declineInvite} />
      </View>
    </Sheet>
  );
}

export function useRoomCoins(initial: number) {
  const [coins, setCoins] = useState(initial);
  useVoltkitEvent('message', (m) => {
    const total = (m.metadata as { roomCoins?: number } | undefined)?.roomCoins;
    if (m.type === 'gift' && typeof total === 'number') setCoins(total);
  });
  return compact(coins);
}

const styles = StyleSheet.create({
  who: { flexDirection: 'row', alignItems: 'center', gap: 22, paddingHorizontal: 12, marginBottom: 12, marginTop: 8 },
  section: { color: colors.textFaint, marginBottom: 4, letterSpacing: 1 },
  person: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 7 },
  accept: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: radius.pill, backgroundColor: colors.gold },
  decline: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: radius.pill, backgroundColor: colors.glassStrong },
});
