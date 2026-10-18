import type {FeatureState} from "../types/portal";
import {POS_MORE_MENU_ITEMS,POS_SETTINGS_MENU_ITEMS} from "../config/pos-menu-catalog";
import {CRM_MORE_MENU_KEYS,CRM_SETTINGS_MENU_KEYS,isCrmMenuEnabled} from "./crm-menu-policy";
import {isCustomMenuVisible} from "./custom-menu-access";

type Access=Pick<FeatureState,"is_custom"|"is_internal_test_full"|"menu_policy">;

/** Filter nested CRM category cards by the same IT policy and POS/contract
 * eligibility as the actual child. Never show empty category cards. */
export function visibleCrmMoreItems(
  policy:Record<string,boolean>,state:Access|null,keys:readonly string[]
){
  if(!state)return [];
  return POS_MORE_MENU_ITEMS.filter(item=>
    keys.includes(item.key) &&
    isCrmMenuEnabled(policy,CRM_MORE_MENU_KEYS[item.key]) &&
    (!(state.is_custom||state.is_internal_test_full)||isCustomMenuVisible(state,item.key))
  );
}

export function visibleCrmSettingsItems(
  policy:Record<string,boolean>,state:Access|null,kinds:readonly string[]
){
  if(!state)return [];
  return POS_SETTINGS_MENU_ITEMS.filter(item=>
    kinds.includes(item.kind) &&
    isCrmMenuEnabled(policy,CRM_SETTINGS_MENU_KEYS[item.key]) &&
    (item.key!=="settings.currency" && item.key!=="settings.branding" ||
      (state.is_custom===true && isCustomMenuVisible(state,item.key))) &&
    (!(state.is_custom||state.is_internal_test_full)||isCustomMenuVisible(state,item.key))
  );
}
