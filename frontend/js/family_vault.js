// backend/static/js/family_vault.js
// Saral Niti — Client-Side Household Persona Vault (Saral Parivar)
// Zero-Knowledge, Zero-PII-Server-Storage, DPDP-Compliant Household Roster Manager
// Enables multi-member scheme discovery for self and family members (parents, children, grandparents).

(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    define([], factory);
  } else if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.SaralFamilyVault = factory();
  }
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const STORAGE_KEY = 'saral_family_roster';
  const ACTIVE_MEMBER_KEY = 'saral_active_member_id';

  // In-memory fallback if localStorage is disabled or throws QuotaExceededError
  let memoryStorage = {
    roster: null,
    activeId: null
  };

  /**
   * Relationship catalog with localized Hindi & English labels and UI icons.
   */
  const RELATION_METADATA = {
    self: {
      key: 'self',
      labelEn: 'Self',
      labelHi: 'स्वयं',
      icon: 'fa-user',
      avatar: '👤'
    },
    father: {
      key: 'father',
      labelEn: 'Father',
      labelHi: 'पिताजी',
      icon: 'fa-user-tie',
      avatar: '🌾'
    },
    mother: {
      key: 'mother',
      labelEn: 'Mother',
      labelHi: 'माताजी',
      icon: 'fa-person-dress',
      avatar: '👩'
    },
    spouse: {
      key: 'spouse',
      labelEn: 'Spouse',
      labelHi: 'जीवनसाथी',
      icon: 'fa-heart',
      avatar: '💍'
    },
    son: {
      key: 'son',
      labelEn: 'Son',
      labelHi: 'बेटा',
      icon: 'fa-child',
      avatar: '👦'
    },
    daughter: {
      key: 'daughter',
      labelEn: 'Daughter',
      labelHi: 'बेटी',
      icon: 'fa-child-dress',
      avatar: '👧'
    },
    brother: {
      key: 'brother',
      labelEn: 'Brother',
      labelHi: 'भाई',
      icon: 'fa-user-group',
      avatar: '🧑'
    },
    sister: {
      key: 'sister',
      labelEn: 'Sister',
      labelHi: 'बहन',
      icon: 'fa-person-dress',
      avatar: '👧'
    },
    grandfather: {
      key: 'grandfather',
      labelEn: 'Grandfather',
      labelHi: 'दादाजी / नानाजी',
      icon: 'fa-person-cane',
      avatar: '👴'
    },
    grandmother: {
      key: 'grandmother',
      labelEn: 'Grandmother',
      labelHi: 'दादीजी / नानीजी',
      icon: 'fa-person-cane',
      avatar: '👵'
    },
    other: {
      key: 'other',
      labelEn: 'Relative',
      labelHi: 'अन्य परिजन',
      icon: 'fa-user',
      avatar: '👥'
    }
  };

  /**
   * Checks whether localStorage is supported and accessible.
   */
  function isStorageAvailable() {
    try {
      if (typeof window === 'undefined' || !window.localStorage) return false;
      const testKey = '__saral_storage_test__';
      window.localStorage.setItem(testKey, testKey);
      window.localStorage.removeItem(testKey);
      return true;
    } catch (e) {
      return false;
    }
  }

  /**
   * Generates a collision-resistant unique ID for a family member persona.
   */
  function generateMemberId() {
    return 'mem_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 7);
  }

  /**
   * Creates a default primary "Self" persona when initializing a new vault.
   */
  function createDefaultPrimaryMember() {
    const now = new Date().toISOString();
    return {
      id: 'primary_self',
      label: 'Myself (स्वयं)',
      relationship: 'self',
      age: 24,
      gender: 'male',
      caste: 'general',
      state: 'Uttar Pradesh',
      occupation: 'student',
      income: 150000,
      disability: false,
      marital_status: 'single',
      is_primary: true,
      created_at: now,
      updated_at: now
    };
  }

  /**
   * Dispatches a custom DOM event for reactive UI updates across components.
   */
  function emitEvent(eventName, detail) {
    if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
      try {
        const ev = new CustomEvent(eventName, { detail: detail || {} });
        window.dispatchEvent(ev);
      } catch (err) {
        // Fallback for older event listeners
        if (document && document.createEvent) {
          const ev = document.createEvent('CustomEvent');
          ev.initCustomEvent(eventName, true, true, detail || {});
          window.dispatchEvent(ev);
        }
      }
    }
  }

  /**
   * Sanitizes and normalizes member persona data before storage.
   */
  function sanitizeMemberData(raw, existingId, isPrimary) {
    const now = new Date().toISOString();
    const relKey = (raw.relationship || 'other').toLowerCase().trim();
    const meta = RELATION_METADATA[relKey] || RELATION_METADATA.other;

    let age = parseInt(raw.age, 10);
    if (isNaN(age) || age < 0) age = 25;
    if (age > 120) age = 120;

    let income = parseInt(raw.income, 10);
    if (isNaN(income) || income < 0) income = 0;

    const label = String(raw.label || raw.name || meta.labelEn).trim().substring(0, 50);

    return {
      id: existingId || generateMemberId(),
      label: label || meta.labelEn,
      relationship: meta.key,
      age: age,
      gender: ['male', 'female', 'transgender', 'other'].includes(raw.gender) ? raw.gender : 'female',
      caste: ['general', 'obc', 'sc', 'st', 'minority'].includes(raw.caste) ? raw.caste : 'general',
      state: String(raw.state || 'All India').trim().substring(0, 50),
      occupation: String(raw.occupation || 'other').trim().toLowerCase().substring(0, 40),
      income: income,
      disability: Boolean(raw.disability || raw.is_differently_abled),
      marital_status: ['single', 'married', 'widowed', 'divorced'].includes(raw.marital_status) ? raw.marital_status : 'single',
      is_primary: Boolean(isPrimary),
      created_at: raw.created_at || now,
      updated_at: now
    };
  }

  /**
   * Low-level read from persistent storage.
   */
  function readRosterFromStorage() {
    if (isStorageAvailable()) {
      try {
        const raw = window.localStorage.getItem(STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed) && parsed.length > 0) {
            return parsed;
          }
        }
      } catch (e) {
        console.warn('[SaralFamilyVault] Corrupted localStorage data, resetting.', e);
      }
    } else if (memoryStorage.roster) {
      return memoryStorage.roster;
    }

    // Default seed
    const initial = [createDefaultPrimaryMember()];
    writeRosterToStorage(initial);
    return initial;
  }

  /**
   * Low-level write to persistent storage.
   */
  function writeRosterToStorage(roster) {
    if (isStorageAvailable()) {
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(roster));
      } catch (e) {
        console.error('[SaralFamilyVault] Failed to write roster to localStorage:', e);
      }
    }
    memoryStorage.roster = roster;
  }

  /**
   * Low-level read for active persona ID.
   */
  function readActiveIdFromStorage() {
    if (isStorageAvailable()) {
      try {
        return window.localStorage.getItem(ACTIVE_MEMBER_KEY);
      } catch (e) {
        // Fallback to memory
      }
    }
    return memoryStorage.activeId;
  }

  /**
   * Low-level write for active persona ID.
   */
  function writeActiveIdToStorage(id) {
    if (isStorageAvailable()) {
      try {
        window.localStorage.setItem(ACTIVE_MEMBER_KEY, id);
      } catch (e) {
        // Fallback to memory
      }
    }
    memoryStorage.activeId = id;
  }

  // ══════════════════════════════════════════════════════════════════════
  // PUBLIC SARAL FAMILY VAULT API
  // ══════════════════════════════════════════════════════════════════════

  const SaralFamilyVault = {
    RELATION_METADATA: RELATION_METADATA,

    /**
     * Checks if persistent storage is available.
     * @returns {boolean}
     */
    isStorageAvailable: isStorageAvailable,

    /**
     * Retrieves all family member personas in the household vault.
     * @returns {Array<Object>} List of members.
     */
    getMembers: function () {
      return readRosterFromStorage();
    },

    /**
     * Finds a member persona by their unique ID.
     * @param {string} id
     * @returns {Object|null}
     */
    getMemberById: function (id) {
      if (!id) return null;
      const members = this.getMembers();
      return members.find(function (m) { return m.id === id; }) || null;
    },

    /**
     * Gets the currently active member persona.
     * If none is selected or selected ID no longer exists, falls back to the primary member.
     * @returns {Object}
     */
    getActiveMember: function () {
      const members = this.getMembers();
      const activeId = readActiveIdFromStorage();
      if (activeId) {
        const found = members.find(function (m) { return m.id === activeId; });
        if (found) return found;
      }
      // Fallback: Primary member or first member
      const primary = members.find(function (m) { return m.is_primary; }) || members[0];
      if (primary) {
        writeActiveIdToStorage(primary.id);
      }
      return primary;
    },

    /**
     * Switches the active member persona across the platform.
     * Dispatches `saral:active_persona_changed` for reactive UI updates.
     * @param {string} id Member persona ID.
     * @returns {Object|null} The newly active member.
     */
    setActiveMember: function (id) {
      const member = this.getMemberById(id);
      if (!member) {
        console.warn('[SaralFamilyVault] Member not found with id:', id);
        return null;
      }
      const previousActive = readActiveIdFromStorage();
      writeActiveIdToStorage(member.id);

      emitEvent('saral:active_persona_changed', {
        member: member,
        previousId: previousActive
      });

      return member;
    },

    /**
     * Adds a new member persona to the household vault.
     * Dispatches `saral:family_vault_updated`.
     * @param {Object} data Member attributes.
     * @returns {Object} Newly created member persona.
     */
    addMember: function (data) {
      if (!data || typeof data !== 'object') {
        throw new Error('[SaralFamilyVault] Invalid member data');
      }
      const members = this.getMembers();
      const sanitized = sanitizeMemberData(data, null, false);
      members.push(sanitized);
      writeRosterToStorage(members);

      emitEvent('saral:family_vault_updated', {
        action: 'add',
        member: sanitized,
        roster: members
      });

      return sanitized;
    },

    /**
     * Updates an existing member persona in the household vault.
     * Dispatches `saral:family_vault_updated`.
     * @param {string} id Member ID.
     * @param {Object} updates Partial member attributes.
     * @returns {Object|null} Updated member persona.
     */
    updateMember: function (id, updates) {
      if (!id || !updates) return null;
      const members = this.getMembers();
      const idx = members.findIndex(function (m) { return m.id === id; });
      if (idx === -1) return null;

      const current = members[idx];
      const merged = Object.assign({}, current, updates);
      const sanitized = sanitizeMemberData(merged, id, current.is_primary);

      members[idx] = sanitized;
      writeRosterToStorage(members);

      emitEvent('saral:family_vault_updated', {
        action: 'update',
        member: sanitized,
        roster: members
      });

      // If active member was updated, notify listeners
      if (readActiveIdFromStorage() === id) {
        emitEvent('saral:active_persona_changed', {
          member: sanitized,
          previousId: id
        });
      }

      return sanitized;
    },

    /**
     * Removes a member persona from the household vault.
     * Will not remove the primary 'Self' member.
     * @param {string} id Member ID.
     * @returns {boolean} True if removed.
     */
    deleteMember: function (id) {
      if (!id) return false;
      const members = this.getMembers();
      const target = members.find(function (m) { return m.id === id; });
      if (!target) return false;

      // Protect primary persona
      if (target.is_primary) {
        console.warn('[SaralFamilyVault] Cannot delete the primary user persona.');
        return false;
      }

      const filtered = members.filter(function (m) { return m.id !== id; });
      writeRosterToStorage(filtered);

      // If deleted member was active, fallback to primary
      if (readActiveIdFromStorage() === id) {
        const primary = filtered.find(function (m) { return m.is_primary; }) || filtered[0];
        if (primary) {
          this.setActiveMember(primary.id);
        }
      }

      emitEvent('saral:family_vault_updated', {
        action: 'delete',
        deletedId: id,
        roster: filtered
      });

      return true;
    },

    /**
     * Resets the family vault to the default clean state with a single primary user.
     */
    resetVault: function () {
      const initial = [createDefaultPrimaryMember()];
      writeRosterToStorage(initial);
      writeActiveIdToStorage(initial[0].id);

      emitEvent('saral:family_vault_updated', {
        action: 'reset',
        roster: initial
      });
      emitEvent('saral:active_persona_changed', {
        member: initial[0],
        previousId: null
      });

      return initial;
    },

    /**
     * Exports the vault as a clean JSON string for local user backup or transfer.
     * @returns {string}
     */
    exportVaultJSON: function () {
      return JSON.stringify({
        schema: 'saral_family_vault_v1',
        exported_at: new Date().toISOString(),
        roster: this.getMembers(),
        active_id: readActiveIdFromStorage()
      }, null, 2);
    },

    /**
     * Safely imports a previously exported vault JSON string.
     * @param {string} jsonStr
     * @returns {boolean} True if successfully imported.
     */
    importVaultJSON: function (jsonStr) {
      try {
        const data = JSON.parse(jsonStr);
        if (!data || !Array.isArray(data.roster) || data.roster.length === 0) {
          throw new Error('Invalid vault structure');
        }
        const validated = data.roster.map(function (item, idx) {
          return sanitizeMemberData(item, item.id, idx === 0 || item.is_primary);
        });
        writeRosterToStorage(validated);
        if (data.active_id && validated.find(function (m) { return m.id === data.active_id; })) {
          writeActiveIdToStorage(data.active_id);
        } else {
          writeActiveIdToStorage(validated[0].id);
        }

        emitEvent('saral:family_vault_updated', {
          action: 'import',
          roster: validated
        });
        emitEvent('saral:active_persona_changed', {
          member: this.getActiveMember(),
          previousId: null
        });

        return true;
      } catch (err) {
        console.error('[SaralFamilyVault] Import failed:', err);
        return false;
      }
    },

    /**
     * Formats an active persona into a compact demographic context object
     * ready for `/api/chatbot` and `/api/recommend` endpoints.
     * @param {Object} [member] Optional member; defaults to active member.
     * @returns {Object}
     */
    toChatbotContext: function (member) {
      const m = member || this.getActiveMember();
      if (!m) return null;
      return {
        member_id: m.id,
        label: m.label,
        relationship: m.relationship,
        age: m.age,
        gender: m.gender,
        caste: m.caste,
        state: m.state,
        occupation: m.occupation,
        income: m.income,
        disability: m.disability,
        marital_status: m.marital_status
      };
    },

    /**
     * Computes aggregate household statistics (household size, vulnerable members,
     * student count, senior citizens, farmers).
     * @returns {Object}
     */
    getHouseholdSummary: function () {
      const members = this.getMembers();
      const summary = {
        total_members: members.length,
        senior_citizens: 0,
        students: 0,
        farmers: 0,
        differently_abled: 0,
        women: 0,
        children: 0,
        states: []
      };

      const statesSet = {};
      members.forEach(function (m) {
        if (m.age >= 60) summary.senior_citizens++;
        if (m.age < 18) summary.children++;
        if (m.gender === 'female') summary.women++;
        if (m.occupation === 'student') summary.students++;
        if (m.occupation === 'farmer') summary.farmers++;
        if (m.disability) summary.differently_abled++;
        if (m.state && m.state !== 'All India') statesSet[m.state] = true;
      });

      summary.states = Object.keys(statesSet);
      return summary;
    }
  };

  return SaralFamilyVault;
}));
