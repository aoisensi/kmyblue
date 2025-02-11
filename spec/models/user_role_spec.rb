# frozen_string_literal: true

require 'rails_helper'

RSpec.describe UserRole do
  subject { described_class.create(name: 'Foo', position: 1) }

  describe '#can?' do
    context 'with a single flag' do
      it 'returns true if any of them are present' do
        subject.permissions = UserRole::FLAGS[:manage_reports]
        expect(subject.can?(:manage_reports)).to be true
      end

      it 'returns false if it is not set' do
        expect(subject.can?(:manage_reports)).to be false
      end
    end

    context 'with multiple flags' do
      it 'returns true if any of them are present' do
        subject.permissions = UserRole::FLAGS[:manage_users]
        expect(subject.can?(:manage_reports, :manage_users)).to be true
      end

      it 'returns false if none of them are present' do
        expect(subject.can?(:manage_reports, :manage_users)).to be false
      end
    end

    context 'with an unknown flag' do
      it 'raises an error' do
        expect { subject.can?(:foo) }.to raise_error ArgumentError
      end
    end
  end

  describe '#overrides?' do
    it 'returns true if other role has lower position' do
      expect(subject.overrides?(described_class.new(position: subject.position - 1))).to be true
    end

    it 'returns true if other role is nil' do
      expect(subject.overrides?(nil)).to be true
    end

    it 'returns false if other role has higher position' do
      expect(subject.overrides?(described_class.new(position: subject.position + 1))).to be false
    end
  end

  describe '#permissions_as_keys' do
    before do
      subject.permissions = UserRole::FLAGS[:invite_users] | UserRole::FLAGS[:view_dashboard] | UserRole::FLAGS[:manage_reports]
    end

    it 'returns an array' do
      expect(subject.permissions_as_keys).to match_array %w(invite_users view_dashboard manage_reports)
    end
  end

  describe '#permissions_as_keys=' do
    let(:input) { nil }

    before do
      subject.permissions_as_keys = input
    end

    context 'with a single value' do
      let(:input) { %w(manage_users) }

      it 'sets permission flags' do
        expect(subject.permissions).to eq UserRole::FLAGS[:manage_users]
      end
    end

    context 'with multiple values' do
      let(:input) { %w(manage_users manage_reports) }

      it 'sets permission flags' do
        expect(subject.permissions).to eq UserRole::FLAGS[:manage_users] | UserRole::FLAGS[:manage_reports]
      end
    end

    context 'with an unknown value' do
      let(:input) { %w(foo) }

      it 'does not set permission flags' do
        expect(subject.permissions).to eq UserRole::Flags::NONE
      end
    end
  end

  describe '#computed_permissions' do
    context 'when the role is nobody' do
      subject { described_class.nobody }

      it 'returns none' do
        expect(subject.computed_permissions).to eq UserRole::Flags::NONE
      end
    end

    context 'when the role is everyone' do
      subject { described_class.everyone }

      it 'returns permissions' do
        expect(subject.computed_permissions).to eq subject.permissions
      end
    end

    context 'when role has the administrator flag' do
      before do
        subject.permissions = UserRole::FLAGS[:administrator]
      end

      it 'returns all permissions' do
        expect(subject.computed_permissions).to eq UserRole::Flags::ALL
      end
    end

    it 'returns permissions combined with the everyone role' do
      expect(subject.computed_permissions).to eq described_class.everyone.permissions
    end
  end

  describe '.everyone' do
    subject { described_class.everyone }

    it 'returns a role' do
      expect(subject).to be_a(described_class)
    end

    it 'is identified as the everyone role' do
      expect(subject.everyone?).to be true
    end

    it 'has default permissions' do
      expect(subject.permissions).to eq 0
    end

    it 'has negative position' do
      expect(subject.position).to eq(described_class::NOBODY_POSITION)
    end

    it 'is able to add invite permission' do
      expect { subject.update!(permissions: UserRole::FLAGS[:invite_users]) }.to_not raise_error
    end
  end

  describe '.nobody' do
    subject { described_class.nobody }

    it 'returns a role' do
      expect(subject).to be_a(described_class)
    end

    it 'is identified as the nobody role' do
      expect(subject.nobody?).to be true
    end

    it 'has no permissions' do
      expect(subject.permissions).to eq UserRole::Flags::NONE
    end

    it 'has negative position' do
      expect(subject.position).to eq(described_class::NOBODY_POSITION)
    end
  end

  describe '#everyone?' do
    it 'returns true when id matches the everyone id' do
      subject.id = described_class::EVERYONE_ROLE_ID
      expect(subject.everyone?).to be true
    end

    it 'returns false when id does not match the everyone id' do
      subject.id = 123
      expect(subject.everyone?).to be false
    end
  end

  describe '#nobody?' do
    it 'returns true when id is nil' do
      subject.id = nil
      expect(subject.nobody?).to be true
    end

    it 'returns false when id is not nil' do
      subject.id = 123
      expect(subject.nobody?).to be false
    end
  end
end
