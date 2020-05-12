// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {Modal} from 'react-bootstrap';
import {FormattedMessage} from 'react-intl';

import {UserProfile} from 'mattermost-redux/types/users';
import {Team} from 'mattermost-redux/types/teams';

import {Client4} from 'mattermost-redux/client';

import {displayEntireNameForUser, localizeMessage, isGuest} from 'utils/utils.jsx';
import ProfilePicture from 'components/profile_picture';
import GuestBadge from 'components/widgets/badges/guest_badge';
import BotBadge from 'components/widgets/badges/bot_badge';
import MultiSelect, {Value} from 'components/multiselect/multiselect';
import AddIcon from 'components/widgets/icons/fa_add_icon';

const USERS_PER_PAGE = 50;
const MAX_SELECTABLE_VALUES = 20;

type UserProfileValue = Value & UserProfile;

type Props = {
    team: Team;
    users: UserProfile[];
    excludeUsers: { [userId: string]: UserProfile };
    includeUsers: { [userId: string]: UserProfile };
    onAddCallback: (users: UserProfile[]) => void;
    onHide?: () => void;

    actions: {
        getProfilesNotInTeam: (teamId: string, groupConstrained: boolean, page: number, perPage?: number) => Promise<{ data: UserProfile[] }>;
        searchProfiles: (term: string, options?: any) => Promise<{ data: UserProfile[] }>;
    };
}

type State = {
    searchResults: UserProfile[];
    values: UserProfileValue[];
    show: boolean;
    search: boolean;
    saving: boolean;
    addError: null;
    loading: boolean;
}

export default class AddUsersToTeamModal extends React.PureComponent<Props, State> {
    public constructor(props: Props) {
        super(props);

        this.state = {
            searchResults: [],
            values: [],
            show: true,
            search: false,
            saving: false,
            addError: null,
            loading: true,
        };
    }
    public componentDidMount = async () => {
        await this.props.actions.getProfilesNotInTeam(this.props.team.id, false, 0, USERS_PER_PAGE * 2);
        this.setUsersLoadingState(false);
    }

    private setUsersLoadingState = (loading: boolean) => {
        this.setState({loading});
    }

    public search = async (term: string) => {
        this.setState({loading: true});
        let searchResults: UserProfile[] = [];
        const search = term !== '';
        if (search) {
            const {data} = await this.props.actions.searchProfiles(term, {not_in_team_id: this.props.team.id, replace: true});
            searchResults = data;
        } else {
            await this.props.actions.getProfilesNotInTeam(this.props.team.id, false, 0, USERS_PER_PAGE * 2);
        }
        this.setState({loading: false, searchResults, search});
    }

    public handleHide = () => {
        this.setState({show: false});
    }

    private handleExit = () => {
        if (this.props.onHide) {
            this.props.onHide();
        }
    }

    private renderOption = (option: UserProfileValue, isSelected: boolean, onAdd: (user: UserProfileValue) => void, onMouseMove: (user: UserProfileValue) => void) => {
        let rowSelected = '';
        if (isSelected) {
            rowSelected = 'more-modal__row--selected';
        }

        return (
            <div
                key={option.id}
                ref={isSelected ? 'selected' : option.id}
                className={'more-modal__row clickable ' + rowSelected}
                onClick={() => onAdd(option)}
                onMouseMove={() => onMouseMove(option)}
            >
                <ProfilePicture
                    src={Client4.getProfilePictureUrl(option.id, option.last_picture_update)}
                    size='md'
                />
                <div className='more-modal__details'>
                    <div className='more-modal__name'>
                        {displayEntireNameForUser(option)}
                        <BotBadge
                            show={Boolean(option.is_bot)}
                            className='badge-popoverlist'
                        />
                        <GuestBadge
                            show={isGuest(option)}
                            className='popoverlist'
                        />
                    </div>
                </div>
                <div className='more-modal__actions'>
                    <div className='more-modal__actions--round'>
                        <AddIcon/>
                    </div>
                </div>
            </div>
        );
    }

    private renderValue = (value: { data: UserProfileValue }): string => {
        return value.data.username;
    }

    private renderAriaLabel = (option: UserProfileValue): string | null => {
        if (!option) {
            return null;
        }
        return option.username;
    }

    private handleAdd = (value: UserProfileValue) => {
        const values: UserProfileValue[] = Object.assign([], this.state.values);
        if (values.indexOf(value) === -1) {
            values.push(value);
        }
        this.setState({values});
    }

    private handleDelete = (values: UserProfileValue[]) => {
        this.setState({values});
    }

    private handlePageChange = (page: number, prevPage: number) => {
        if (page > prevPage) {
            const needMoreUsers = (this.props.users.length / USERS_PER_PAGE) <= page + 1;
            this.setState({loading: needMoreUsers});
            this.props.actions.getProfilesNotInTeam(this.props.team.id, false, page, USERS_PER_PAGE * 2).then(() => this.setState({loading: false}));
        }
    };

    private handleSubmit = () => {
        this.props.onAddCallback(this.state.values);
        this.handleHide();
    }

    public render = (): JSX.Element => {
        const numRemainingText = (
            <div id='numPeopleRemaining'>
                <FormattedMessage
                    id='multiselect.numPeopleRemaining'
                    defaultMessage='Use ↑↓ to browse, ↵ to select. You can add {num, number} more {num, plural, one {person} other {people}}. '
                    values={{
                        num: MAX_SELECTABLE_VALUES - this.state.values.length,
                    }}
                />
            </div>
        );

        const buttonSubmitText = localizeMessage('multiselect.add', 'Add');
        const buttonSubmitLoadingText = localizeMessage('multiselect.adding', 'Adding...');

        let addError = null;
        if (this.state.addError) {
            addError = (<div className='has-error col-sm-12'><label className='control-label font-weight--normal'>{this.state.addError}</label></div>);
        }

        let usersToDisplay: UserProfile[] = [];
        usersToDisplay = this.state.search ? this.state.searchResults : this.props.users;
        if (this.props.excludeUsers) {
            const hasUser = (user: UserProfile) => !this.props.excludeUsers[user.id];
            usersToDisplay = usersToDisplay.filter(hasUser);
        }
        if (this.props.includeUsers) {
            const includeUsers = Object.values(this.props.includeUsers);
            usersToDisplay = [...usersToDisplay, ...includeUsers];
        }

        const options = usersToDisplay.map((user) => {
            return {label: user.username, value: user.id, ...user};
        });

        return (
            <Modal
                id='addUsersToTeamModal'
                dialogClassName={'a11y__modal more-modal more-direct-channels'}
                show={this.state.show}
                onHide={this.handleHide}
                onExited={this.handleExit}
            >
                <Modal.Header closeButton={true}>
                    <Modal.Title componentClass='h1'>
                        <FormattedMessage
                            id='add_users_to_team.title'
                            defaultMessage='Add New Members to {teamName} Team'
                            values={{
                                teamName: (
                                    <strong>{this.props.team.name}</strong>
                                ),
                            }}
                        />
                    </Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    {addError}
                    <MultiSelect
                        key='addUsersToTeamKey'
                        options={options}
                        optionRenderer={this.renderOption}
                        values={this.state.values}
                        valueRenderer={this.renderValue}
                        perPage={USERS_PER_PAGE}
                        handlePageChange={this.handlePageChange}
                        handleInput={this.search}
                        handleDelete={this.handleDelete}
                        handleAdd={this.handleAdd}
                        handleSubmit={this.handleSubmit}
                        maxValues={MAX_SELECTABLE_VALUES}
                        numRemainingText={numRemainingText}
                        buttonSubmitText={buttonSubmitText}
                        buttonSubmitLoadingText={buttonSubmitLoadingText}
                        saving={this.state.saving}
                        loading={this.state.loading}
                        placeholderText={localizeMessage('multiselect.placeholder', 'Search and add members')}
                    />
                </Modal.Body>
            </Modal>
        );
    }
}
