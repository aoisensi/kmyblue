# frozen_string_literal: true

require 'rails_helper'

RSpec.describe DeleteAccountService, type: :service do
  shared_examples 'common behavior' do
    subject { described_class.new.call(account) }

    before do
      account.follow!(list_target_account)
      circle_target_account.follow!(account)
    end

    let!(:status) { Fabricate(:status, account: account) }
    let!(:mention) { Fabricate(:mention, account: local_follower) }
    let!(:status_with_mention) { Fabricate(:status, account: account, mentions: [mention]) }
    let!(:media_attachment) { Fabricate(:media_attachment, account: account) }
    let!(:notification) { Fabricate(:notification, account: account) }
    let!(:favourite) { Fabricate(:favourite, account: account, status: Fabricate(:status, account: local_follower)) }
    let!(:emoji_reaction) { Fabricate(:emoji_reaction, account: account, status: Fabricate(:status, account: local_follower)) }
    let!(:bookmark) { Fabricate(:bookmark, account: account) }
    let!(:poll) { Fabricate(:poll, account: account) }
    let!(:poll_vote) { Fabricate(:poll_vote, account: local_follower, poll: poll) }

    let!(:active_relationship) { Fabricate(:follow, account: account, target_account: local_follower) }
    let!(:passive_relationship) { Fabricate(:follow, account: local_follower, target_account: account) }
    let!(:endorsement) { Fabricate(:account_pin, account: local_follower, target_account: account) }

    let!(:mention_notification) { Fabricate(:notification, account: local_follower, activity: mention, type: :mention) }
    let!(:status_notification) { Fabricate(:notification, account: local_follower, activity: status, type: :status) }
    let!(:poll_notification) { Fabricate(:notification, account: local_follower, activity: poll, type: :poll) }
    let!(:favourite_notification) { Fabricate(:notification, account: local_follower, activity: favourite, type: :favourite) }
    let!(:emoji_reaction_notification) { Fabricate(:notification, account: local_follower, activity: emoji_reaction, type: :emoji_reaction) }
    let!(:follow_notification) { Fabricate(:notification, account: local_follower, activity: active_relationship, type: :follow) }

    let!(:list) { Fabricate(:list, account: account) }
    let!(:list_account) { Fabricate(:list_account, list: list, account: list_target_account) }
    let!(:list_target_account) { Fabricate(:account) }
    let!(:antenna) { Fabricate(:antenna, account: account) }
    let!(:antenna_account) { Fabricate(:antenna_account, antenna: antenna, account: list_target_account) }
    let!(:circle) { Fabricate(:circle, account: account) }
    let!(:circle_account) { Fabricate(:circle_account, circle: circle, account: circle_target_account) }
    let!(:circle_target_account) { Fabricate(:account) }
    let!(:circle_status) { Fabricate(:circle_status, circle: circle, status: Fabricate(:status, account: account, visibility: :limited)) }
    let!(:bookmark_category) { Fabricate(:bookmark_category, account: account) }
    let!(:bookmark_category_status) { Fabricate(:bookmark_category_status, bookmark_category: bookmark_category, status: bookmark.status) }

    let!(:account_note) { Fabricate(:account_note, account: account) }

    let!(:ng_rule_history) { Fabricate(:ng_rule_history, account: account) }
    let!(:pending_follow_request) { Fabricate(:pending_follow_request, account: account) }
    let!(:pending_status) { Fabricate(:pending_status, account: account, uri: 'https://example.com/note1') }
    let!(:fetchable_pending_status) { Fabricate(:pending_status, fetch_account: account, uri: 'https://example.com/note2') }

    it 'deletes associated owned and target records and target notifications' do
      subject

      expect_deletion_of_associated_owned_records
      expect_deletion_of_associated_target_records
      expect_deletion_of_associated_target_notifications
    end

    it 'deletes associated owned record groups' do # rubocop:disable RSpec/MultipleExpectations
      expect { subject }.to change {
        [
          account.owned_lists,
          account.antennas,
          account.circles,
          account.bookmark_categories,
        ].map(&:count)
      }.from([1, 1, 1, 1]).to([0, 0, 0, 0])
      expect { list_target_account.reload }.to_not raise_error
      expect { bookmark_category_status.status.reload }.to_not raise_error
      expect { antenna_account.account.reload }.to_not raise_error
      expect { circle_account.account.reload }.to_not raise_error
      expect { ng_rule_history.reload }.to_not raise_error
      expect { list.reload }.to raise_error(ActiveRecord::RecordNotFound)
      expect { list_account.reload }.to raise_error(ActiveRecord::RecordNotFound)
      expect { antenna_account.reload }.to raise_error(ActiveRecord::RecordNotFound)
      expect { circle_account.reload }.to raise_error(ActiveRecord::RecordNotFound)
      expect { circle_status.reload }.to raise_error(ActiveRecord::RecordNotFound)
      expect { bookmark_category_status.reload }.to raise_error(ActiveRecord::RecordNotFound)
      expect { pending_follow_request.reload }.to raise_error(ActiveRecord::RecordNotFound)
      expect { pending_status.reload }.to raise_error(ActiveRecord::RecordNotFound)
      expect { fetchable_pending_status.reload }.to raise_error(ActiveRecord::RecordNotFound)
    end

    def expect_deletion_of_associated_owned_records
      expect { status.reload }.to raise_error(ActiveRecord::RecordNotFound)
      expect { status_with_mention.reload }.to raise_error(ActiveRecord::RecordNotFound)
      expect { mention.reload }.to raise_error(ActiveRecord::RecordNotFound)
      expect { media_attachment.reload }.to raise_error(ActiveRecord::RecordNotFound)
      expect { notification.reload }.to raise_error(ActiveRecord::RecordNotFound)
      expect { favourite.reload }.to raise_error(ActiveRecord::RecordNotFound)
      expect { emoji_reaction.reload }.to raise_error(ActiveRecord::RecordNotFound)
      expect { bookmark.reload }.to raise_error(ActiveRecord::RecordNotFound)
      expect { active_relationship.reload }.to raise_error(ActiveRecord::RecordNotFound)
      expect { passive_relationship.reload }.to raise_error(ActiveRecord::RecordNotFound)
      expect { poll.reload }.to raise_error(ActiveRecord::RecordNotFound)
      expect { poll_vote.reload }.to raise_error(ActiveRecord::RecordNotFound)
      expect { account_note.reload }.to raise_error(ActiveRecord::RecordNotFound)
    end

    def expect_deletion_of_associated_target_records
      expect { endorsement.reload }.to raise_error(ActiveRecord::RecordNotFound)
    end

    def account_pins_for_account
      AccountPin.where(target_account: account)
    end

    def expect_deletion_of_associated_target_notifications
      expect { favourite_notification.reload }.to raise_error(ActiveRecord::RecordNotFound)
      expect { follow_notification.reload }.to raise_error(ActiveRecord::RecordNotFound)
      expect { mention_notification.reload }.to raise_error(ActiveRecord::RecordNotFound)
      expect { poll_notification.reload }.to raise_error(ActiveRecord::RecordNotFound)
      expect { status_notification.reload }.to raise_error(ActiveRecord::RecordNotFound)
      expect { emoji_reaction_notification.reload }.to raise_error(ActiveRecord::RecordNotFound)
    end
  end

  describe '#call on local account', :sidekiq_inline do
    before do
      stub_request(:post, remote_alice.inbox_url).to_return(status: 201)
      stub_request(:post, remote_bob.inbox_url).to_return(status: 201)
    end

    let!(:remote_alice) { Fabricate(:account, inbox_url: 'https://alice.com/inbox', domain: 'alice.com', protocol: :activitypub) }
    let!(:remote_bob) { Fabricate(:account, inbox_url: 'https://bob.com/inbox', domain: 'bob.com', protocol: :activitypub) }

    include_examples 'common behavior' do
      let(:account) { Fabricate(:account) }
      let(:local_follower) { Fabricate(:account) }

      it 'sends a delete actor activity to all known inboxes' do
        subject
        expect(a_request(:post, remote_alice.inbox_url)).to have_been_made.once
        expect(a_request(:post, remote_bob.inbox_url)).to have_been_made.once
      end
    end
  end

  describe '#call on remote account', :sidekiq_inline do
    before do
      stub_request(:post, account.inbox_url).to_return(status: 201)
    end

    include_examples 'common behavior' do
      let(:account) { Fabricate(:account, inbox_url: 'https://bob.com/inbox', protocol: :activitypub, domain: 'bob.com') }
      let(:local_follower) { Fabricate(:account) }

      it 'sends expected activities to followed and follower inboxes' do
        subject

        expect(post_to_inbox_with_reject).to have_been_made.once
        expect(post_to_inbox_with_undo).to have_been_made.once
      end

      def post_to_inbox_with_undo
        a_request(:post, account.inbox_url).with(
          body: hash_including({
            'type' => 'Undo',
            'object' => hash_including({
              'type' => 'Follow',
              'actor' => ActivityPub::TagManager.instance.uri_for(local_follower),
              'object' => account.uri,
            }),
          })
        )
      end

      def post_to_inbox_with_reject
        a_request(:post, account.inbox_url).with(
          body: hash_including({
            'type' => 'Reject',
            'object' => hash_including({
              'type' => 'Follow',
              'actor' => account.uri,
              'object' => ActivityPub::TagManager.instance.uri_for(local_follower),
            }),
          })
        )
      end
    end
  end
end
