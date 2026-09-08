/**
 * SheetPunch / CrewClock - Team Management (Admin RBAC)
 */
window.CrewClock = window.CrewClock || {};

(function (exports) {
  'use strict';

  function getEl() {
    return exports.dom?.el || window.el || {};
  }

  function getState() {
    return exports.state || window.CrewClock?.state || {};
  }

  function openTeamModal() {
    const el = getEl();
    const state = getState();
    const currentUser = state.currentUser;

    if (!currentUser || currentUser.role !== 'admin') {
      alert('Only authorized business Admins can access Team Management.');
      return;
    }
    if (el.teamModal) el.teamModal.classList.remove('hidden');
    if (el.inviteStatusMsg) el.inviteStatusMsg.textContent = '';
    loadTeamRoster();
  }

  function closeTeamModal() {
    const el = getEl();
    if (el.teamModal) el.teamModal.classList.add('hidden');
    const setActiveMobileTab = exports.setActiveMobileTab || window.setActiveMobileTab;
    if (typeof setActiveMobileTab === 'function') setActiveMobileTab('shift');
  }

  async function loadTeamRoster() {
    const el = getEl();
    const state = getState();
    const currentUser = state.currentUser;
    const callTenancyApi = exports.callTenancyApi || window.callTenancyApi;
    const escapeHtml = exports.escapeHtml || window.escapeHtml || function (s) { return s; };

    if (!currentUser || !el.teamListContainer) return;
    el.teamListContainer.innerHTML = `
      <div class="text-center py-6 text-warmgray-400 text-xs animate-pulse">
        Fetching team roster from directory...
      </div>
    `;

    try {
      if (typeof callTenancyApi !== 'function') throw new Error('Tenancy client is unavailable.');
      const res = await callTenancyApi('get_team', { adminEmail: currentUser.email });
      if (!res.success) throw new Error(res.error || 'Could not fetch team list');

      const team = res.team || [];
      if (team.length === 0) {
        el.teamListContainer.innerHTML = `
          <div class="text-center py-8 text-warmgray-500 text-xs">
            <p class="font-medium">No team members invited yet.</p>
            <p class="text-warmgray-400 text-[11px] mt-1">Invite your staff using their Google or Google Workspace email above!</p>
          </div>
        `;
        return;
      }

      el.teamListContainer.innerHTML = '';
      team.forEach((member) => {
        const isSelf = member.email.toLowerCase() === currentUser.email.toLowerCase();
        const isAdmin = member.role === 'admin';
        const card = document.createElement('div');
        card.className = 'flex items-center justify-between p-3 rounded-2xl bg-white/90 border border-warmgray-200/80 shadow-xs text-xs';

        card.innerHTML = `
          <div class="flex items-center gap-2.5 min-w-0">
            <div class="w-8 h-8 rounded-full ${isAdmin ? 'bg-amber-100 text-amber-800' : 'bg-warmgray-100 text-warmgray-700'} flex items-center justify-center font-bold text-xs flex-shrink-0">
              ${escapeHtml((member.name || 'U').charAt(0).toUpperCase())}
            </div>
            <div class="min-w-0">
              <div class="flex items-center gap-1.5">
                <span class="font-bold text-warmgray-900 truncate">${escapeHtml(member.name || 'Staff')}</span>
                <span class="px-1.5 py-0.2 text-[9px] font-bold uppercase rounded ${isAdmin ? 'bg-amber-100 text-amber-800 border border-amber-200' : 'bg-warmgray-100 text-warmgray-700 border border-warmgray-200'}">
                  ${escapeHtml(member.role)}
                </span>
                ${isSelf ? '<span class="text-[10px] text-warmgray-400">(You)</span>' : ''}
              </div>
              <p class="text-[11px] text-warmgray-500 font-mono truncate">${escapeHtml(member.email)}</p>
            </div>
          </div>
          <div>
            ${!isSelf ? `
              <button data-remove-email="${escapeHtml(member.email)}" data-remove-name="${escapeHtml(member.name || '')}" class="btn-remove-member px-2.5 py-1 rounded-xl text-[11px] font-semibold text-rose-600 hover:bg-rose-50 border border-rose-200 transition-colors">
                Remove
              </button>
            ` : `
              <span class="text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">Active</span>
            `}
          </div>
        `;
        el.teamListContainer.appendChild(card);
      });

      // Bind dynamic remove buttons
      el.teamListContainer.querySelectorAll('.btn-remove-member').forEach((btn) => {
        btn.addEventListener('click', (e) => {
          const email = e.currentTarget.getAttribute('data-remove-email');
          const name = e.currentTarget.getAttribute('data-remove-name');
          removeTeamMember(email, name);
        });
      });

    } catch (err) {
      el.teamListContainer.innerHTML = `
        <div class="p-3 bg-rose-50 text-rose-800 text-xs rounded-xl border border-rose-200">
          Failed to load team roster: ${escapeHtml(err.message)}
        </div>
      `;
    }
  }

  async function inviteTeamMember() {
    const el = getEl();
    const state = getState();
    const currentUser = state.currentUser;
    const callTenancyApi = exports.callTenancyApi || window.callTenancyApi;
    const escapeHtml = exports.escapeHtml || window.escapeHtml || function (s) { return s; };

    const email = (el.inputInviteEmail?.value || '').trim().toLowerCase();
    const name = (el.inputInviteName?.value || '').trim() || 'Staff Member';

    if (!email) {
      if (el.inviteStatusMsg) el.inviteStatusMsg.textContent = 'Please enter a Google or Workspace email address.';
      el.inputInviteEmail?.focus();
      return;
    }

    if (!email.includes('@')) {
      if (el.inviteStatusMsg) el.inviteStatusMsg.textContent = 'Please enter a valid email address.';
      return;
    }

    try {
      if (el.inviteStatusMsg) el.inviteStatusMsg.textContent = 'Sending email invitation...';
      if (el.btnSendInvite) el.btnSendInvite.disabled = true;

      const currentAppUrl = window.location.href.split('#')[0].split('?')[0];
      const res = await callTenancyApi('invite_employee', {
        adminEmail: currentUser.email,
        inviteEmail: email,
        inviteName: name,
        appUrl: currentAppUrl
      });

      if (!res.success) {
        throw new Error(res.error || 'Failed to send invitation.');
      }

      if (el.inviteStatusMsg) {
        el.inviteStatusMsg.innerHTML = `<span class="text-emerald-700 font-bold">✓ Invitation sent to ${escapeHtml(email)}!</span>`;
      }
      if (el.inputInviteEmail) el.inputInviteEmail.value = '';
      if (el.inputInviteName) el.inputInviteName.value = '';

      loadTeamRoster();
    } catch (err) {
      if (el.inviteStatusMsg) {
        el.inviteStatusMsg.innerHTML = `<span class="text-rose-700 font-bold">Error: ${escapeHtml(err.message)}</span>`;
      }
    } finally {
      if (el.btnSendInvite) el.btnSendInvite.disabled = false;
    }
  }

  async function removeTeamMember(targetEmail, targetName) {
    const state = getState();
    const currentUser = state.currentUser;
    const showConfirmDialog = exports.dom?.showConfirmDialog || window.showConfirmDialog;
    const showLoading = exports.dom?.showLoading || window.showLoading || function () {};
    const hideLoading = exports.dom?.hideLoading || window.hideLoading || function () {};
    const callTenancyApi = exports.callTenancyApi || window.callTenancyApi;

    const displayName = targetName ? `${targetName} (${targetEmail})` : targetEmail;
    const confirmed = await showConfirmDialog({
      title: 'Remove Team Member?',
      message: `Are you sure you want to remove ${displayName} from your team?\n\nThey will no longer be permitted to sign in or clock in.`,
      confirmText: 'Remove Member',
      cancelText: 'Cancel',
      type: 'rose'
    });
    if (!confirmed) return;

    try {
      showLoading('Removing Staff Member', `Revoking access for ${targetEmail}...`);
      const res = await callTenancyApi('remove_employee', {
        adminEmail: currentUser.email,
        targetEmail: targetEmail
      });
      hideLoading();

      if (!res.success) {
        throw new Error(res.error || 'Could not remove team member.');
      }

      loadTeamRoster();
    } catch (err) {
      hideLoading();
      alert('Error removing member: ' + err.message);
    }
  }

  // Exports
  exports.openTeamModal = openTeamModal;
  exports.closeTeamModal = closeTeamModal;
  exports.loadTeamRoster = loadTeamRoster;
  exports.inviteTeamMember = inviteTeamMember;
  exports.removeTeamMember = removeTeamMember;

  // Global fallbacks
  window.openTeamModal = openTeamModal;
  window.closeTeamModal = closeTeamModal;
  window.loadTeamRoster = loadTeamRoster;
  window.inviteTeamMember = inviteTeamMember;
  window.removeTeamMember = removeTeamMember;

})(window.CrewClock);
