import PropTypes from 'prop-types';

import { defineMessages, injectIntl } from 'react-intl';

import { Helmet } from 'react-helmet';

import { List as ImmutableList } from 'immutable';
import ImmutablePropTypes from 'react-immutable-proptypes';
import ImmutablePureComponent from 'react-immutable-pure-component';
import { connect } from 'react-redux';

import CirclesIcon from '@/material-icons/400-24px/account_circle-fill.svg?react';
import AlternateEmailIcon from '@/material-icons/400-24px/alternate_email.svg?react';
import BookmarksIcon from '@/material-icons/400-24px/bookmarks-fill.svg?react';
import PeopleIcon from '@/material-icons/400-24px/group.svg?react';
import HomeIcon from '@/material-icons/400-24px/home-fill.svg?react';
import ListAltIcon from '@/material-icons/400-24px/list_alt.svg?react';
import MenuIcon from '@/material-icons/400-24px/menu.svg?react';
import PersonAddIcon from '@/material-icons/400-24px/person_add.svg?react';
import PublicIcon from '@/material-icons/400-24px/public.svg?react';
import SettingsIcon from '@/material-icons/400-24px/settings-fill.svg?react';
import StarIcon from '@/material-icons/400-24px/star.svg?react';
import TagIcon from '@/material-icons/400-24px/tag.svg?react';
import AntennaIcon from '@/material-icons/400-24px/wifi.svg?react';
import { fetchFollowRequests } from 'mastodon/actions/accounts';
import Column from 'mastodon/components/column';
import ColumnHeader from 'mastodon/components/column_header';
import LinkFooter from 'mastodon/features/ui/components/link_footer';

import { dtlTag, enableDtlMenu, me, showTrends } from '../../initial_state';
import { NavigationBar } from '../compose/components/navigation_bar';
import ColumnLink from '../ui/components/column_link';
import ColumnSubheading from '../ui/components/column_subheading';

import TrendsContainer from './containers/trends_container';

const messages = defineMessages({
  home_timeline: { id: 'tabs_bar.home', defaultMessage: 'Home' },
  notifications: { id: 'tabs_bar.notifications', defaultMessage: 'Notifications' },
  public_timeline: { id: 'navigation_bar.public_timeline', defaultMessage: 'Federated timeline' },
  settings_subheading: { id: 'column_subheading.settings', defaultMessage: 'Settings' },
  community_timeline: { id: 'navigation_bar.community_timeline', defaultMessage: 'Local timeline' },
  deep_timeline: { id: 'navigation_bar.deep_timeline', defaultMessage: 'Deep timeline' },
  explore: { id: 'navigation_bar.explore', defaultMessage: 'Explore' },
  direct: { id: 'navigation_bar.direct', defaultMessage: 'Private mentions' },
  bookmarks: { id: 'navigation_bar.bookmarks', defaultMessage: 'Bookmarks' },
  preferences: { id: 'navigation_bar.preferences', defaultMessage: 'Preferences' },
  follow_requests: { id: 'navigation_bar.follow_requests', defaultMessage: 'Follow requests' },
  favourites: { id: 'navigation_bar.favourites', defaultMessage: 'Favorites' },
  blocks: { id: 'navigation_bar.blocks', defaultMessage: 'Blocked users' },
  domain_blocks: { id: 'navigation_bar.domain_blocks', defaultMessage: 'Blocked domains' },
  mutes: { id: 'navigation_bar.mutes', defaultMessage: 'Muted users' },
  pins: { id: 'navigation_bar.pins', defaultMessage: 'Pinned posts' },
  lists: { id: 'navigation_bar.lists', defaultMessage: 'Lists' },
  antennas: { id: 'navigation_bar.antennas', defaultMessage: 'Antennas' },
  circles: { id: 'navigation_bar.circles', defaultMessage: 'Circles' },
  discover: { id: 'navigation_bar.discover', defaultMessage: 'Discover' },
  personal: { id: 'navigation_bar.personal', defaultMessage: 'Personal' },
  security: { id: 'navigation_bar.security', defaultMessage: 'Security' },
  menu: { id: 'getting_started.heading', defaultMessage: 'Getting started' },
});

const mapStateToProps = state => ({
  myAccount: state.getIn(['accounts', me]),
  unreadFollowRequests: state.getIn(['user_lists', 'follow_requests', 'items'], ImmutableList()).size,
});

const mapDispatchToProps = dispatch => ({
  fetchFollowRequests: () => dispatch(fetchFollowRequests()),
});

const badgeDisplay = (number, limit) => {
  if (number === 0) {
    return undefined;
  } else if (limit && number >= limit) {
    return `${limit}+`;
  } else {
    return number;
  }
};

class GettingStarted extends ImmutablePureComponent {

  static contextTypes = {
    identity: PropTypes.object,
  };

  static propTypes = {
    intl: PropTypes.object.isRequired,
    myAccount: ImmutablePropTypes.map,
    multiColumn: PropTypes.bool,
    fetchFollowRequests: PropTypes.func.isRequired,
    unreadFollowRequests: PropTypes.number,
    unreadNotifications: PropTypes.number,
  };

  componentDidMount () {
    const { fetchFollowRequests } = this.props;
    const { signedIn } = this.context.identity;

    if (!signedIn) {
      return;
    }

    fetchFollowRequests();
  }

  render () {
    const { intl, myAccount, multiColumn, unreadFollowRequests } = this.props;
    const { signedIn } = this.context.identity;

    const navItems = [];

    navItems.push(
      <ColumnSubheading key='header-discover' text={intl.formatMessage(messages.discover)} />,
    );

    if (showTrends) {
      navItems.push(
        <ColumnLink key='explore' icon='explore' iconComponent={TagIcon} text={intl.formatMessage(messages.explore)} to='/explore' />,
      );
    }

    navItems.push(
      <ColumnLink key='community_timeline' icon='users' iconComponent={PeopleIcon} text={intl.formatMessage(messages.community_timeline)} to='/public/local' />,
    );

    if (signedIn && enableDtlMenu && dtlTag) {
      navItems.push(
        <ColumnLink key='deep_timeline' icon='users' iconComponent={PeopleIcon} text={intl.formatMessage(messages.deep_timeline)} to={`/tags/${dtlTag}`} />,
      );
    }

    navItems.push(
      <ColumnLink key='public_timeline' icon='globe' iconComponent={PublicIcon} text={intl.formatMessage(messages.public_timeline)} to='/public' />,
    );

    if (signedIn) {
      navItems.push(
        <ColumnSubheading key='header-personal' text={intl.formatMessage(messages.personal)} />,
        <ColumnLink key='home' icon='home' iconComponent={HomeIcon} text={intl.formatMessage(messages.home_timeline)} to='/home' />,
        <ColumnLink key='direct' icon='at' iconComponent={AlternateEmailIcon} text={intl.formatMessage(messages.direct)} to='/conversations' />,
        <ColumnLink key='bookmark' icon='bookmarks' iconComponent={BookmarksIcon} text={intl.formatMessage(messages.bookmarks)} to='/bookmark_categories' />,
        <ColumnLink key='favourites' icon='star' iconComponent={StarIcon} text={intl.formatMessage(messages.favourites)} to='/favourites' />,
        <ColumnLink key='lists' icon='list-ul' iconComponent={ListAltIcon} text={intl.formatMessage(messages.lists)} to='/lists' />,
        <ColumnLink key='antennas' icon='wifi' iconComponent={AntennaIcon} text={intl.formatMessage(messages.antennas)} to='/antennasw' />,
        <ColumnLink key='circles' icon='user-circle' iconComponent={CirclesIcon} text={intl.formatMessage(messages.circles)} to='/circles' />,
      );

      if (myAccount.get('locked') || unreadFollowRequests > 0) {
        navItems.push(<ColumnLink key='follow_requests' icon='user-plus' iconComponent={PersonAddIcon} text={intl.formatMessage(messages.follow_requests)} badge={badgeDisplay(unreadFollowRequests, 40)} to='/follow_requests' />);
      }

      navItems.push(
        <ColumnSubheading key='header-settings' text={intl.formatMessage(messages.settings_subheading)} />,
        <ColumnLink key='preferences' icon='cog' iconComponent={SettingsIcon} text={intl.formatMessage(messages.preferences)} href='/settings/preferences' />,
      );
    }

    return (
      <Column>
        {(signedIn && !multiColumn) ? <NavigationBar /> : <ColumnHeader title={intl.formatMessage(messages.menu)} icon='bars' iconComponent={MenuIcon} multiColumn={multiColumn} />}

        <div className='getting-started scrollable scrollable--flex'>
          <div className='getting-started__wrapper'>
            {navItems}
          </div>

          {!multiColumn && <div className='flex-spacer' />}

          <LinkFooter multiColumn />
        </div>

        {(multiColumn && showTrends) && <TrendsContainer />}

        <Helmet>
          <title>{intl.formatMessage(messages.menu)}</title>
          <meta name='robots' content='noindex' />
        </Helmet>
      </Column>
    );
  }

}

export default connect(mapStateToProps, mapDispatchToProps)(injectIntl(GettingStarted));
