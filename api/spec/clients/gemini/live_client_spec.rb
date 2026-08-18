# frozen_string_literal: true

require "rails_helper"

RSpec.describe Gemini::LiveClient do
  subject(:client) { described_class.new(system_prompt: "You are an interviewer.") }

  let(:fake_ws) { instance_double(Faye::WebSocket::Client, send: nil) }

  def mark_connected!
    client.instance_variable_set(:@connected, true)
    client.instance_variable_set(:@ws, fake_ws)
  end

  # F19 typed-answer fallback — candidate answers by typing. Unlike #inject_context
  # (realtimeInput.text, used for silent context like coverage digests — it never
  # prompts a reply on its own), a typed answer needs to actually elicit a spoken
  # response, so it goes through the same clientContent+turnComplete mechanism as
  # #trigger_opening, which is the only path in this client proven to make Gemini
  # generate a response without live audio.
  describe "#send_text_turn" do
    it "sends a user clientContent turn with turnComplete: true" do
      mark_connected!

      client.send_text_turn("I'd use a message queue.")

      expect(fake_ws).to have_received(:send) do |payload|
        parsed = JSON.parse(payload)
        expect(parsed["clientContent"]["turns"]).to eq(
          [{ "role" => "user", "parts" => [{ "text" => "I'd use a message queue." }] }]
        )
        expect(parsed["clientContent"]["turnComplete"]).to eq(true)
      end
    end

    it "returns true when the message was sent" do
      mark_connected!

      expect(client.send_text_turn("hello")).to eq(true)
    end

    it "returns false and sends nothing when not connected" do
      expect(client.send_text_turn("hello")).to eq(false)
      expect(fake_ws).not_to have_received(:send)
    end
  end
end
